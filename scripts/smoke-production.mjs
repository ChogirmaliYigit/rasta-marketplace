import assert from 'node:assert/strict';
import { loadDeployment } from './deploy-config.mjs';

// Creates and revokes login sessions only; does not create business data.
const { env, urls } = loadDeployment(process.argv[2]);
for (const origin of Object.values(urls)) {
  const response = await fetch(origin + '/api/health', { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  const redirect = await fetch(origin.replace('https:', 'http:') + '/api/health', { redirect: 'manual' });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('location'), origin + '/api/health');
}
const headers = { 'Content-Type': 'application/json', 'X-Rasta-App': 'admin', Origin: urls.admin };
const denied = await fetch(urls.admin + '/api/state', { headers });
assert.equal(denied.status, 401);
const login = await fetch(urls.admin + '/api/login', {
  method: 'POST', headers,
  body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }),
});
assert.equal(login.status, 200, 'Admin login failed');
const cookies = login.headers.getSetCookie();
assert.equal(cookies.length, 1);
assert.match(cookies[0], /HttpOnly/i);
assert.match(cookies[0], /Secure/i);
assert.match(cookies[0], /SameSite=Strict/i);
assert.doesNotMatch(cookies[0], /Domain=/i);
const authenticated = { ...headers, Cookie: cookies[0].split(';')[0] };
try {
  const response = await fetch(urls.admin + '/api/state', { headers: authenticated });
  assert.equal(response.status, 200);
  const state = await response.json();
  assert.equal(state.user.role, 'admin');
  assert.equal(state.user.email, env.ADMIN_EMAIL);
  assert.equal(JSON.stringify(state).includes('passwordHash'), false);
  console.log(JSON.stringify({ ok: true, admin: state.user.email, suppliers: state.suppliers.length, stores: state.stores.length, products: state.products.length, orders: state.orders.length }));
} finally {
  const logout = await fetch(urls.admin + '/api/logout', { method: 'POST', headers: authenticated, body: '{}' });
  assert.equal(logout.status, 200);
}
assert.equal((await fetch(urls.admin + '/api/state', { headers: authenticated })).status, 401);
console.log('HTTPS, HTTP redirects, secure admin session, API data and logout verified.');
