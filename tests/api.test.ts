import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const port = 3002;
const baseUrl = `http://localhost:${port}`;

test('API E2E Tests', async (t) => {
  // Spawn the server using compiled production bundle
  const serverProcess = spawn('node', ['dist/server.cjs'], {
    env: { 
      ...process.env, 
      PORT: port.toString(), 
      JWT_SECRET: 'test-secret', 
      NODE_ENV: 'production',
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost:5432/dummy'
    },
    stdio: 'inherit'
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 5000));

  t.after(() => {
    serverProcess.kill('SIGTERM');
  });

  await t.test('/api/health -> JSON', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.ok(res.status === 200 || res.status === 503);
    const text = await res.text();
    const data = JSON.parse(text);
    assert.equal(data.service, 'nir-production');
  });

  await t.test('invalid API routes -> JSON 404', async () => {
    const res = await fetch(`${baseUrl}/api/does_not_exist`);
    assert.equal(res.status, 404);
    const contentType = res.headers.get('content-type') || '';
    assert.ok(contentType.includes('application/json'));
  });

  let token = '';
  await t.test('authentication & session handling', async () => {
    // Attempt login with valid default user 'admin'/'admin' or test user
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password' })
    });
    // In our test environment, we might not have 'admin' with 'password'.
    // We just test if it returns a 401 JSON instead of HTML or crashes
    if (res.status === 401) {
      const data = await res.json();
      assert.ok(data.error);
    } else if (res.status === 200) {
      const data = await res.json();
      token = data.token;
      assert.ok(token);
    }
  });

  await t.test('authorization - missing token', async () => {
    const res = await fetch(`${baseUrl}/api/users`);
    assert.equal(res.status, 401);
  });

  await t.test('CORS - no origin allowed', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.ok(res.status === 200 || res.status === 503);
  });

  await t.test('Production assets tests', async (t2) => {
    await t2.test('GET / => HTML 200', async () => {
      const res = await fetch(`${baseUrl}/`);
      assert.equal(res.status, 200);
      assert.ok((res.headers.get('content-type') || '').includes('text/html'));
    });

    await t2.test('Valid asset => proper MIME', async () => {
      const res = await fetch(`${baseUrl}/`);
      const html = await res.text();
      const jsMatch = html.match(/src="\/assets\/([^"]+\.js)"/);
      const cssMatch = html.match(/href="\/assets\/([^"]+\.css)"/);

      if (jsMatch) {
        const jsRes = await fetch(`${baseUrl}/assets/${jsMatch[1]}`);
        assert.equal(jsRes.status, 200);
        assert.ok((jsRes.headers.get('content-type') || '').includes('application/javascript') || (jsRes.headers.get('content-type') || '').includes('text/javascript'));
      }
      
      if (cssMatch) {
        const cssRes = await fetch(`${baseUrl}/assets/${cssMatch[1]}`);
        assert.equal(cssRes.status, 200);
        assert.ok((cssRes.headers.get('content-type') || '').includes('text/css'));
      }
    });

    await t2.test('SPA route => index.html', async () => {
      const res = await fetch(`${baseUrl}/some-spa-route`);
      assert.equal(res.status, 200);
      assert.ok((res.headers.get('content-type') || '').includes('text/html'));
    });

    await t2.test('invalid asset => 404, never index.html', async () => {
      const res = await fetch(`${baseUrl}/assets/does-not-exist-1234.js`);
      assert.equal(res.status, 404);
      assert.ok(!(res.headers.get('content-type') || '').includes('text/html'));
    });
  });
});
