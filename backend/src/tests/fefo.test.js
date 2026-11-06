import test from 'node:test';
import assert from 'node:assert/strict';

// Pure algorithm mock representing FEFO allocation logic
function mockFEFOAllocation(batches, requestedQuantity) {
  // Filter active, non-expired, positive stock batches
  const today = new Date('2026-10-18');
  const validBatches = batches
    .filter(b => b.status === 'active' && new Date(b.expiryDate) > today && b.qty > 0)
    .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  let remaining = requestedQuantity;
  const allocations = [];

  for (const b of validBatches) {
    if (remaining <= 0) break;
    const take = Math.min(b.qty, remaining);
    allocations.push({
      batchId: b.id,
      batchNumber: b.batchNo,
      allocated: take,
      expiryDate: b.expiryDate,
    });
    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error(`Insufficient stock: requested ${requestedQuantity}`);
  }

  return allocations;
}

test('FEFO Allocation - Orders by Earliest Expiry First', () => {
  const batches = [
    { id: 2, batchNo: 'PAN-2026-12', expiryDate: '2026-12-31', qty: 50, status: 'active' },
    { id: 1, batchNo: 'PAN-2026-11', expiryDate: '2026-11-30', qty: 20, status: 'active' },
    { id: 3, batchNo: 'PAN-2027-01', expiryDate: '2027-01-31', qty: 100, status: 'active' },
  ];

  // Request 25 units: should take 20 from PAN-2026-11 (earlier expiry) and 5 from PAN-2026-12
  const result = mockFEFOAllocation(batches, 25);

  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].batchNumber, 'PAN-2026-11');
  assert.strictEqual(result[0].allocated, 20);
  assert.strictEqual(result[1].batchNumber, 'PAN-2026-12');
  assert.strictEqual(result[1].allocated, 5);
});

test('FEFO Allocation - Rejects Expired and Recalled Batches', () => {
  const batches = [
    { id: 1, batchNo: 'EXP-001', expiryDate: '2024-01-01', qty: 100, status: 'expired' },
    { id: 2, batchNo: 'REC-002', expiryDate: '2027-01-01', qty: 100, status: 'recalled' },
    { id: 3, batchNo: 'ACT-003', expiryDate: '2026-11-30', qty: 15, status: 'active' },
  ];

  // Request 10 units: should ONLY allocate from ACT-003
  const result = mockFEFOAllocation(batches, 10);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].batchNumber, 'ACT-003');
  assert.strictEqual(result[0].allocated, 10);

  // Request 20 units: ACT-003 only has 15, others are invalid -> must throw Insufficient stock
  assert.throws(() => {
    mockFEFOAllocation(batches, 20);
  }, /Insufficient stock/);
});
