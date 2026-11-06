import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { query, getPool } from '../config/db.js';
import { processPOSCheckout } from '../services/pos.service.js';

let testRoleId = null;
let testUserId = null;
let testCategoryId = null;
let testDosageFormId = null;
let activeMedId = null;
let activeBatchId = null;
let blockedMedId = null;
let expiredBatchId = null;
let recalledBatchId = null;
let quarantinedBatchId = null;

const testTimestamp = Date.now();
const testRoleName = `test_pos_role_${testTimestamp}`;
const testUserName = `test_pos_cashier_${testTimestamp}`;

before(async () => {
  // 1. Ensure currency exists for foreign key constraint fk_sale_currency
  await query(
    `INSERT IGNORE INTO currencies (code, name, symbol, locale, exchange_rate, is_base, is_active)
     VALUES ('PKR', 'Pakistani Rupee', '₨', 'ur-PK', 1.000000, TRUE, TRUE)`
  );

  // 2. Create isolated test role & user to satisfy fk_sale_cashier
  const roleRes = await query(
    `INSERT INTO roles (name, display_name, description, is_system_role)
     VALUES (?, 'Test Cashier Role', 'Role for isolated POS tests', FALSE)`,
    [testRoleName]
  );
  testRoleId = roleRes.insertId;

  const userRes = await query(
    `INSERT INTO users (role_id, username, email, password_hash, full_name, status)
     VALUES (?, ?, ?, '$2a$12$testdummyhashforisolatedposchecks', 'Test Cashier User', 'active')`,
    [testRoleId, testUserName, `${testUserName}@testpharmacy.internal`]
  );
  testUserId = userRes.insertId;

  // 2. Resolve category & dosage form
  const catRows = await query('SELECT id FROM categories LIMIT 1');
  if (catRows.length > 0) {
    testCategoryId = catRows[0].id;
  } else {
    const cRes = await query("INSERT INTO categories (name, description) VALUES ('Test Cat POS', 'Test')");
    testCategoryId = cRes.insertId;
  }

  const dfRows = await query('SELECT id FROM dosage_forms LIMIT 1');
  if (dfRows.length > 0) {
    testDosageFormId = dfRows[0].id;
  } else {
    const dRes = await query("INSERT INTO dosage_forms (name, description) VALUES ('Test Tab POS', 'Test')");
    testDosageFormId = dRes.insertId;
  }

  // 3. Create isolated Active Medicine & Batch
  const medRes = await query(
    `INSERT INTO medicines (generic_name, brand_name, category_id, dosage_form_id, strength, strength_unit, barcode, status)
     VALUES (?, ?, ?, ?, '500', 'mg', ?, 'active')`,
    [`Gen-Active-${testTimestamp}`, `Brand-Active-${testTimestamp}`, testCategoryId, testDosageFormId, `BAR-ACT-${testTimestamp}`]
  );
  activeMedId = medRes.insertId;

  const batchRes = await query(
    `INSERT INTO batches (batch_number, medicine_id, manufacturing_date, expiry_date, initial_quantity, quantity_on_hand, cost_price, selling_price, status)
     VALUES (?, ?, '2025-01-01', '2028-12-31', 100, 100, 15.00, 25.00, 'active')`,
    [`BAT-ACT-${testTimestamp}`, activeMedId]
  );
  activeBatchId = batchRes.insertId;

  // 4. Create isolated Blocked Medicine (Expired, Recalled, Quarantined)
  const blockedMedRes = await query(
    `INSERT INTO medicines (generic_name, brand_name, category_id, dosage_form_id, strength, strength_unit, barcode, status)
     VALUES (?, ?, ?, ?, '250', 'mg', ?, 'active')`,
    [`Gen-Blocked-${testTimestamp}`, `Brand-Blocked-${testTimestamp}`, testCategoryId, testDosageFormId, `BAR-BLK-${testTimestamp}`]
  );
  blockedMedId = blockedMedRes.insertId;

  const expRes = await query(
    `INSERT INTO batches (batch_number, medicine_id, manufacturing_date, expiry_date, initial_quantity, quantity_on_hand, cost_price, selling_price, status)
     VALUES (?, ?, '2023-01-01', '2024-01-01', 50, 50, 10.00, 20.00, 'expired')`,
    [`BAT-EXP-${testTimestamp}`, blockedMedId]
  );
  expiredBatchId = expRes.insertId;

  const recRes = await query(
    `INSERT INTO batches (batch_number, medicine_id, manufacturing_date, expiry_date, initial_quantity, quantity_on_hand, cost_price, selling_price, status)
     VALUES (?, ?, '2025-01-01', '2028-01-01', 50, 50, 10.00, 20.00, 'recalled')`,
    [`BAT-REC-${testTimestamp}`, blockedMedId]
  );
  recalledBatchId = recRes.insertId;

  const quarRes = await query(
    `INSERT INTO batches (batch_number, medicine_id, manufacturing_date, expiry_date, initial_quantity, quantity_on_hand, cost_price, selling_price, status)
     VALUES (?, ?, '2025-01-01', '2028-01-01', 50, 50, 10.00, 20.00, 'quarantined')`,
    [`BAT-QUA-${testTimestamp}`, blockedMedId]
  );
  quarantinedBatchId = quarRes.insertId;
});

after(async () => {
  try {
    // Isolated teardown strictly in child-to-parent foreign key order
    if (testUserId) {
      await query('DELETE FROM payments WHERE sale_id IN (SELECT id FROM sales WHERE cashier_user_id = ?)', [testUserId]);
      await query('DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE cashier_user_id = ?)', [testUserId]);
      await query('DELETE FROM sales WHERE cashier_user_id = ?', [testUserId]);
      await query('DELETE FROM audit_logs WHERE user_id = ?', [testUserId]);
    }
    const testBatchIds = [activeBatchId, expiredBatchId, recalledBatchId, quarantinedBatchId].filter(Boolean);
    for (const bId of testBatchIds) {
      await query('DELETE FROM stock_movements WHERE batch_id = ?', [bId]);
      await query('DELETE FROM batches WHERE id = ?', [bId]);
    }
    const testMedIds = [activeMedId, blockedMedId].filter(Boolean);
    for (const mId of testMedIds) {
      await query('DELETE FROM medicines WHERE id = ?', [mId]);
    }
    if (testUserId) {
      await query('DELETE FROM users WHERE id = ?', [testUserId]);
    }
    if (testRoleId) {
      await query('DELETE FROM roles WHERE id = ?', [testRoleId]);
    }
    await getPool().end();
  } catch (err) {
    console.error('Test cleanup error:', err.message);
  }
});

test('POS Checkout - Successful Checkout deducts stock and records movement ledger', async () => {
  const checkoutPayload = {
    customerId: null,
    items: [{ medicineId: activeMedId, quantity: 15 }],
    invoiceDiscount: 0,
    paymentMethod: 'cash',
  };

  const result = await processPOSCheckout(checkoutPayload, testUserId);

  assert.ok(result.saleId, 'Sale ID must be returned');
  assert.ok(result.invoiceNumber, 'Invoice number must be generated');
  assert.strictEqual(result.items.length, 1);
  assert.strictEqual(result.items[0].quantity, 15);

  // 1. Verify batch stock was decremented from 100 to 85 (100 - 15)
  const batchRows = await query('SELECT quantity_on_hand, status FROM batches WHERE id = ?', [activeBatchId]);
  assert.strictEqual(batchRows[0].quantity_on_hand, 85, 'Batch stock on hand should be exactly 85');
  assert.strictEqual(batchRows[0].status, 'active');

  // 2. Verify stock_movements entry exists
  const movements = await query(
    `SELECT * FROM stock_movements
      WHERE batch_id = ? AND reference_type = 'sale' AND reference_id = ?`,
    [activeBatchId, result.invoiceNumber]
  );
  assert.strictEqual(movements.length, 1, 'Exactly one stock movement ledger entry must be recorded');
  assert.strictEqual(movements[0].movement_type, 'SALE_DISPENSE');
  assert.strictEqual(movements[0].quantity_change, -15);
  assert.strictEqual(movements[0].previous_quantity, 100);
  assert.strictEqual(movements[0].new_quantity, 85);
  assert.strictEqual(movements[0].performed_by_user_id, testUserId);

  // 3. Verify sale & sale_items records exist
  const saleRows = await query('SELECT id, status, payment_status FROM sales WHERE id = ?', [result.saleId]);
  assert.strictEqual(saleRows.length, 1);
  assert.strictEqual(saleRows[0].status, 'completed');
  assert.strictEqual(saleRows[0].payment_status, 'paid');

  const itemRows = await query('SELECT * FROM sale_items WHERE sale_id = ?', [result.saleId]);
  assert.strictEqual(itemRows.length, 1);
  assert.strictEqual(itemRows[0].quantity, 15);
});

test('POS Checkout - Insufficient stock throws error and preserves batch stock', async () => {
  // Current active stock is 85; attempt to purchase 200
  const checkoutPayload = {
    customerId: null,
    items: [{ medicineId: activeMedId, quantity: 200 }],
    paymentMethod: 'cash',
  };

  await assert.rejects(
    async () => {
      await processPOSCheckout(checkoutPayload, testUserId);
    },
    (err) => {
      assert.match(err.message, /Insufficient stock/i);
      return true;
    }
  );

  // Stock must remain unchanged at 85
  const batchRows = await query('SELECT quantity_on_hand FROM batches WHERE id = ?', [activeBatchId]);
  assert.strictEqual(batchRows[0].quantity_on_hand, 85, 'Batch stock must not be altered on failed checkout');
});

test('POS Checkout - Rejects expired, recalled, and quarantined batches', async () => {
  const checkoutPayload = {
    customerId: null,
    items: [{ medicineId: blockedMedId, quantity: 1 }],
    paymentMethod: 'cash',
  };

  await assert.rejects(
    async () => {
      await processPOSCheckout(checkoutPayload, testUserId);
    },
    (err) => {
      assert.match(err.message, /No active, unexpired stock available/i);
      return true;
    }
  );

  // Expired, recalled, and quarantined batches must not have changed
  const expBatch = await query('SELECT quantity_on_hand FROM batches WHERE id = ?', [expiredBatchId]);
  assert.strictEqual(expBatch[0].quantity_on_hand, 50);

  const recBatch = await query('SELECT quantity_on_hand FROM batches WHERE id = ?', [recalledBatchId]);
  assert.strictEqual(recBatch[0].quantity_on_hand, 50);

  const quaBatch = await query('SELECT quantity_on_hand FROM batches WHERE id = ?', [quarantinedBatchId]);
  assert.strictEqual(quaBatch[0].quantity_on_hand, 50);
});

test('POS Checkout - Multi-item transaction rollback leaves no orphaned records', async () => {
  // Baseline check: count sales before the failing multi-item transaction
  const salesBefore = await query('SELECT COUNT(*) AS total FROM sales WHERE cashier_user_id = ?', [testUserId]);
  const movementsBefore = await query('SELECT COUNT(*) AS total FROM stock_movements WHERE batch_id = ?', [activeBatchId]);

  // Request item 1 (valid: 10 units of active medicine) AND item 2 (invalid: blocked medicine)
  const multiItemPayload = {
    customerId: null,
    items: [
      { medicineId: activeMedId, quantity: 10 },
      { medicineId: blockedMedId, quantity: 5 }, // Will cause exception
    ],
    paymentMethod: 'cash',
  };

  await assert.rejects(
    async () => {
      await processPOSCheckout(multiItemPayload, testUserId);
    },
    (err) => {
      assert.match(err.message, /No active, unexpired stock available/i);
      return true;
    }
  );

  // Entire transaction must be rolled back:
  // 1. Active batch stock remains at 85 (10 units NOT deducted)
  const batchRows = await query('SELECT quantity_on_hand FROM batches WHERE id = ?', [activeBatchId]);
  assert.strictEqual(batchRows[0].quantity_on_hand, 85, 'Stock must roll back completely');

  // 2. No new sale created
  const salesAfter = await query('SELECT COUNT(*) AS total FROM sales WHERE cashier_user_id = ?', [testUserId]);
  assert.strictEqual(salesAfter[0].total, salesBefore[0].total, 'No orphaned sale record should exist');

  // 3. No new stock movement created
  const movementsAfter = await query('SELECT COUNT(*) AS total FROM stock_movements WHERE batch_id = ?', [activeBatchId]);
  assert.strictEqual(movementsAfter[0].total, movementsBefore[0].total, 'No orphaned stock movement should exist');
});
