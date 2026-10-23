import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAllowedOrigin } from '../lib/request-origin.ts';

const codespace = { CODESPACES: 'true', CODESPACE_NAME: 'bookwise-auth-test', GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: 'app.github.dev', PORT: '3000' };
function request(origin?: string, host = 'localhost:3000', forwardedHost?: string) {
  const headers = new Headers({ host });
  if (origin !== undefined) headers.set('origin', origin);
  if (forwardedHost !== undefined) headers.set('x-forwarded-host', forwardedHost);
  return { headers };
}

test('direct local browser requests and non-browser clients work', () => {
  assert.equal(isAllowedOrigin(request('http://localhost:3000'), {}), true);
  assert.equal(isAllowedOrigin(request(), {}), true);
  assert.equal(isAllowedOrigin(request('https://unrelated.example'), {}), false);
});

test('normal proxy requests use the forwarded host, including proxy chains', () => {
  assert.equal(isAllowedOrigin(request('https://bookwise.example', 'localhost:3000', 'bookwise.example'), {}), true);
  assert.equal(isAllowedOrigin(request('https://bookwise.example', 'localhost:3000', 'bookwise.example, internal-proxy'), {}), true);
});

test('this Codespaces HTTPS origin is accepted when the proxy rewrites host headers', () => {
  assert.equal(isAllowedOrigin(request('https://bookwise-auth-test-3000.app.github.dev', 'localhost:3000', 'localhost:3000'), codespace), true);
  assert.equal(isAllowedOrigin(request('https://bookwise-auth-test-3000.app.github.dev'), { ...codespace, PORT: undefined }), true);
});

test('other Codespaces, ports, suffix lookalikes and insecure origins stay blocked', () => {
  for (const origin of [
    'https://another-codespace-3000.app.github.dev',
    'https://bookwise-auth-test-4000.app.github.dev',
    'https://bookwise-auth-test-3000.app.github.dev.attacker.example',
    'http://bookwise-auth-test-3000.app.github.dev',
  ]) assert.equal(isAllowedOrigin(request(origin), codespace), false, origin);
});

test('Codespaces trust requires server metadata and honors the configured port', () => {
  assert.equal(isAllowedOrigin(request('https://bookwise-auth-test-3000.app.github.dev'), { ...codespace, CODESPACES: undefined }), false);
  assert.equal(isAllowedOrigin(request('https://bookwise-auth-test-7862.app.github.dev'), { ...codespace, PORT: '7862' }), true);
  assert.equal(isAllowedOrigin(request('https://bookwise-auth-test-3000.app.github.dev'), { ...codespace, CODESPACE_NAME: '' }), false);
});

test('malformed, opaque and non-origin values fail closed rather than throwing', () => {
  for (const origin of ['null', 'not a url', 'javascript:alert(1)', 'https://localhost:3000/extra', 'https://user@localhost:3000']) {
    assert.equal(isAllowedOrigin(request(origin), codespace), false, origin);
  }
});
