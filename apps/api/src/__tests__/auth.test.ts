import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { revokeToken, verifyAdminCredentials, verifyToken, verifyCustomerToken } from '../services/authService';

test('admin token works until logout revokes it', () => {
  const r = verifyAdminCredentials(config.admin.email, config.admin.password)!;
  assert.ok(verifyToken(r.token));
  revokeToken(r.token);
  assert.equal(verifyToken(r.token), null);
});

test('wrong password and unsigned/alg=none tokens are rejected', () => {
  assert.equal(verifyAdminCredentials(config.admin.email, 'nope'), null);
  const none = jwt.sign({ sub: 'x', role: 'admin' }, '', { algorithm: 'none' as never });
  assert.equal(verifyToken(none), null);
});

test('admin token is not accepted as a customer token', () => {
  const r = verifyAdminCredentials(config.admin.email, config.admin.password)!;
  assert.equal(verifyCustomerToken(r.token), null);
});
