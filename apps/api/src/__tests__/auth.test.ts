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

test('deleting a customer account removes personal data and anonymises past orders', async () => {
  const { upsertUser, getUserByPhone, deleteUserAccount, orders, addAddress, setFavoritesFor } = await import('../data/store');
  const phone = '250788000111';
  upsertUser({ id: 'usr-del', name: 'Del Me', phone, role: 'customer', createdAt: new Date().toISOString() });
  addAddress({ phone, name: 'Del Me', province: 'Kigali', district: 'Gasabo', label: 'Home' } as never);
  setFavoritesFor(phone, ['p1']);
  orders.push({ id: 'ord-del', customer: { name: 'Del Me', phone, email: 'a@b.c', address: 'x' } } as never);
  assert.equal(deleteUserAccount(phone), true);
  assert.equal(getUserByPhone(phone), undefined);
  const o = orders.find((x) => x.id === 'ord-del')!;
  assert.equal(o.customer.name, 'Deleted customer');
  assert.equal(o.customer.email, undefined);
  orders.splice(orders.indexOf(o), 1);
});
