import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { isSameOrigin } from '@/lib/request-origin';

function request(origin: string, fetchSite?: string, host = 'internal.local:3000') {
  return new Request('http://internal.local:3000/api/ai/chat', {
    method: 'POST',
    headers: {
      origin,
      host,
      ...(fetchSite ? { 'sec-fetch-site': fetchSite } : {}),
    },
  });
}

void test('accepts browser same-origin requests through a proxy', () => {
  assert.equal(isSameOrigin(request('https://preview.example', 'same-origin')), true);
});

void test('rejects cross-site and same-site browser requests', () => {
  assert.equal(isSameOrigin(request('https://other.example', 'cross-site')), false);
  assert.equal(isSameOrigin(request('https://sub.example.com', 'same-site')), false);
});

void test('checks the URL or Host when browser metadata is absent', () => {
  assert.equal(isSameOrigin(request('http://internal.local:3000')), true);
  assert.equal(isSameOrigin(request('https://other.example')), false);
  assert.equal(isSameOrigin(request('https://preview.example', undefined, 'preview.example')), false);
});

void test('rejects malformed Origin values', () => {
  assert.equal(isSameOrigin(request('null', 'same-origin')), false);
});
