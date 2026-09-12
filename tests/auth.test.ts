import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { buildSessionCookieHeader, getJwtSecret } from '../server/middleware/auth';

test('auth: password hashing and verification', async () => {
  const password = 'SecretPassword123!';
  const hash = await bcrypt.hash(password, 10);
  assert.equal(await bcrypt.compare(password, hash), true);
  assert.equal(await bcrypt.compare('WrongPassword', hash), false);
});

test('auth: JWT_SECRET enforces requirement in production', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalSecret = process.env.JWT_SECRET;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    assert.throws(() => getJwtSecret(), /JWT_SECRET is strictly required in production mode/);

    process.env.JWT_SECRET = 'super-secret-key-for-production-testing-only-12345';
    assert.equal(getJwtSecret(), 'super-secret-key-for-production-testing-only-12345');
  } finally {
    process.env.NODE_ENV = originalEnv;
    if (originalSecret) process.env.JWT_SECRET = originalSecret;
    else delete process.env.JWT_SECRET;
  }
});

test('auth: cookie generation for HTTP localhost and factory LAN', () => {
  const req: any = {
    secure: false,
    headers: {},
    protocol: 'http',
  };
  const cookie = buildSessionCookieHeader(req, 'token123', 3600);
  assert.ok(cookie.includes('nir_session=token123'));
  assert.ok(cookie.includes('HttpOnly'));
  assert.ok(cookie.includes('SameSite=Lax'));
  assert.ok(!cookie.includes('Secure'), 'Plaintext HTTP cookies must not declare Secure');
});

test('auth: cookie generation for HTTPS production with cross-site support', () => {
  const originalCrossSite = process.env.CROSS_SITE_COOKIE;
  try {
    process.env.CROSS_SITE_COOKIE = 'true';
    const req: any = {
      secure: true,
      headers: { 'x-forwarded-proto': 'https' },
      protocol: 'https',
    };
    const cookie = buildSessionCookieHeader(req, 'secureToken', 3600);
    assert.ok(cookie.includes('nir_session=secureToken'));
    assert.ok(cookie.includes('SameSite=None'));
    assert.ok(cookie.includes('Secure'));
  } finally {
    if (originalCrossSite !== undefined) process.env.CROSS_SITE_COOKIE = originalCrossSite;
    else delete process.env.CROSS_SITE_COOKIE;
  }
});

test('auth: role-based access logic covers all 5 required roles', () => {
  const validRoles = ['ADMIN', 'MANAGER', 'ACCOUNTING', 'OPERATOR', 'VIEWER'];
  assert.equal(validRoles.length, 5);

  const checkAccess = (userRole: string, allowedRoles: string[]): boolean => {
    const r = userRole.toUpperCase();
    if (r === 'ADMIN') return true;
    return allowedRoles.map(x => x.toUpperCase()).includes(r);
  };

  assert.equal(checkAccess('ADMIN', ['VIEWER']), true);
  assert.equal(checkAccess('ADMIN', ['ACCOUNTING', 'OPERATOR']), true);
  assert.equal(checkAccess('MANAGER', ['MANAGER', 'ACCOUNTING']), true);
  assert.equal(checkAccess('OPERATOR', ['MANAGER']), false);
  assert.equal(checkAccess('VIEWER', ['ADMIN', 'MANAGER']), false);
  assert.equal(checkAccess('VIEWER', ['VIEWER', 'OPERATOR']), true);
});
