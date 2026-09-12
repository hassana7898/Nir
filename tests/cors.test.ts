import test from 'node:test';
import assert from 'node:assert/strict';
import { isOriginAllowed, parseAllowedOrigins } from '../server/middleware/cors';

test('cors: no origin header is allowed (same-origin / server-to-server / curl)', () => {
  assert.equal(isOriginAllowed(undefined), true);
  assert.equal(isOriginAllowed(''), true);
});

test('cors: parseAllowedOrigins splits comma separated lists', () => {
  const list = parseAllowedOrigins('https://app.factory.com, http://192.168.1.50:3000 , http://localhost:3000');
  assert.deepEqual(list, [
    'https://app.factory.com',
    'http://192.168.1.50:3000',
    'http://localhost:3000'
  ]);
});

test('cors: enforces whitelisted origins', () => {
  const allowed = ['https://factory.internal.net', 'http://192.168.1.100:3000'];

  assert.equal(isOriginAllowed('https://factory.internal.net', allowed), true);
  assert.equal(isOriginAllowed('http://192.168.1.100:3000', allowed), true);

  // Unauthorized origin must be rejected
  assert.equal(isOriginAllowed('https://malicious-site.com', allowed), false);
  assert.equal(isOriginAllowed('http://192.168.1.101:3000', allowed), false);
});

test('cors: wildcard * allows all origins', () => {
  const allowed = ['*'];
  assert.equal(isOriginAllowed('https://any-domain.com', allowed), true);
  assert.equal(isOriginAllowed('http://10.0.0.5:8080', allowed), true);
});

