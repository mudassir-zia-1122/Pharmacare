import test from 'node:test';
import assert from 'node:assert/strict';
import {
  roundCurrency,
  addMoney,
  subtractMoney,
  multiplyLineTotal,
  calculateTax,
  calculateCheckoutTotals,
} from '../utils/decimalMath.js';

test('Financial Math - Currency Rounding', () => {
  assert.strictEqual(roundCurrency(12.3456), 12.35);
  assert.strictEqual(roundCurrency('45.10'), 45.10);
  assert.strictEqual(roundCurrency(0), 0.00);
});

test('Financial Math - Addition and Subtraction prevents IEEE-754 errors', () => {
  // Classic 0.1 + 0.2 === 0.30000000000000004 in raw JS
  assert.strictEqual(addMoney(0.1, 0.2), 0.30);
  assert.strictEqual(subtractMoney(1.0, 0.9), 0.10);
  assert.strictEqual(addMoney(120.50, 45.25), 165.75);
});

test('Financial Math - Line Total Multiplication', () => {
  assert.strictEqual(multiplyLineTotal(18.50, 4), 74.00);
  assert.strictEqual(multiplyLineTotal(300.00, 3), 900.00);
});

test('Financial Math - Tax Calculation', () => {
  // 18% GST on 1000 PKR = 180 PKR
  assert.strictEqual(calculateTax(1000.00, 18.0), 180.00);
  // 0% Tax = 0
  assert.strictEqual(calculateTax(500.00, 0), 0.00);
});

test('Financial Math - Complete Checkout Calculation', () => {
  const items = [
    { quantity: 2, unit_price: 18.00, discount_amount: 0, tax_rate: 0 },
    { quantity: 1, unit_price: 300.00, discount_amount: 50.00, tax_rate: 18.0 },
  ];

  const result = calculateCheckoutTotals(items, 10.00, true);

  // Subtotal = (18*2) + (300*1) = 36 + 300 = 336.00
  assert.strictEqual(result.subtotal, 336.00);
  // Total Discount = 50 (item) + 10 (invoice) = 60.00
  assert.strictEqual(result.discountTotal, 60.00);
  // Taxable base on item 2: 300 - 50 = 250 * 18% = 45.00
  assert.strictEqual(result.taxTotal, 45.00);
  // Net total: (336 - 60) + 45 = 276 + 45 = 321.00
  assert.strictEqual(result.netTotal, 321.00);
});
