import test from 'node:test';
import assert from 'node:assert/strict';
import { securityHeaders } from '../server/middleware/security';

test('security: sets standard security headers', () => {
  const headers: Record<string, string> = {};
  const req: any = {};
  const res: any = {
    setHeader(key: string, value: string) {
      headers[key] = value;
    }
  };
  let nextCalled = false;
  securityHeaders(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-XSS-Protection'], '0');
  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.ok(headers['Content-Security-Policy'].includes('default-src'));
});
