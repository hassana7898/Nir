import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const port = 4001;
const baseUrl = `http://localhost:${port}`;

test('API E2E Tests', async (t) => {
  const serverProcess = spawn('node', ['dist/server.cjs'], {
    env: { 
      ...process.env, 
      PORT: port.toString(), 
      JWT_SECRET: 'test-secret', 
      NODE_ENV: 'production',
      E2E_TEST: 'true'
    },
    stdio: 'inherit'
  });

  // Wait for server to start listening
  let isListening = false;
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.status === 200 || res.status === 503) {
        isListening = true;
        break;
      }
    } catch (e) {
      // ignore connection refused
    }
    await new Promise(r => setTimeout(r, 200));
  }

  if (!isListening) {
    serverProcess.kill('SIGTERM');
    throw new Error('Server failed to start in time');
  }

  t.after(() => {
    serverProcess.kill('SIGTERM');
  });

  await t.test('/api/health -> JSON', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
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
    // 1. Check status
    const statusRes = await fetch(`${baseUrl}/api/auth/status`);
    const statusData = await statusRes.json();
    assert.equal(statusData.setup, false);

    // 2. Setup
    const setupRes = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'password123' })
    });
    assert.equal(setupRes.status, 200);
    const setupData = await setupRes.json();
    assert.equal(setupData.success, true);
    
    // 3. Login
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password123' })
    });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.equal(loginData.success, true);
    token = loginData.token;
    assert.ok(token);
  });

  await t.test('authorization - missing token', async () => {
    const res = await fetch(`${baseUrl}/api/users`);
    assert.equal(res.status, 401);
  });

  await t.test('authorization - valid token', async () => {
    const res = await fetch(`${baseUrl}/api/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data));
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
        const ct = jsRes.headers.get('content-type') || '';
        assert.ok(ct.includes('application/javascript') || ct.includes('text/javascript'));
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
