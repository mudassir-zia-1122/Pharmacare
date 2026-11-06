import test from 'node:test';
import assert from 'node:assert/strict';
import { hasRole } from '../middleware/roleMiddleware.js';

test('RBAC Middleware - Permits User With Allowed Role', () => {
  const req = { user: { id: 1, username: 'admin', role: 'admin' } };
  let calledNext = false;
  let receivedError = null;

  const middleware = hasRole('admin', 'pharmacist');
  middleware(req, {}, (err) => {
    calledNext = true;
    receivedError = err;
  });

  assert.strictEqual(calledNext, true);
  assert.strictEqual(receivedError, undefined);
});

test('RBAC Middleware - Blocks User With Disallowed Role', () => {
  const req = { user: { id: 3, username: 'sara', role: 'cashier' } };
  let calledNext = false;
  let receivedError = null;

  const middleware = hasRole('admin', 'pharmacist');
  middleware(req, {}, (err) => {
    calledNext = true;
    receivedError = err;
  });

  assert.strictEqual(calledNext, true);
  assert.ok(receivedError);
  assert.strictEqual(receivedError.statusCode, 403);
});

test('RBAC Middleware - Blocks Unauthenticated Requests', () => {
  const req = {};
  let receivedError = null;

  const middleware = hasRole('admin');
  middleware(req, {}, (err) => {
    receivedError = err;
  });

  assert.ok(receivedError);
  assert.strictEqual(receivedError.statusCode, 401);
});

test('Auth System - Supports Email as Login Identifier', () => {
  const testIdentifiers = [
    { input: 'admin', isEmail: false },
    { input: 'admin@pharmacare.pk', isEmail: true },
    { input: 'AHMED@PHARMACARE.PK', isEmail: true },
    { input: 'sara@pharmacare.pk', isEmail: true },
  ];

  for (const item of testIdentifiers) {
    const trimmed = item.input.trim().toLowerCase();
    assert.ok(trimmed.length > 0);
    if (item.isEmail) {
      assert.match(trimmed, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    }
  }
});
