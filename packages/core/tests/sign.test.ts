import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildSignHeaders, subtleHmac } from '../dist/sign.js';

describe('sign', () => {
  test('nonce 每次全新生成（修复重放 403）', async () => {
    let n = 0;
    const nonce = () => `nonce-${++n}`;
    const h1 = await buildSignHeaders('POST', 'https://x/api', '{"a":1}', 'tok', subtleHmac, nonce);
    const h2 = await buildSignHeaders('POST', 'https://x/api', '{"a":1}', 'tok', subtleHmac, nonce);
    assert.equal(h1?.a, 'nonce-1');
    assert.equal(h2?.a, 'nonce-2');
    assert.notEqual(h1?.s, h2?.s);
  });

  test('无 token → null（降级不签名）', async () => {
    const h = await buildSignHeaders('GET', 'https://x/api', '', '', subtleHmac, () => 'n');
    assert.equal(h, null);
  });

  test('mh_ck_ 派生密钥签名可重复校验', async () => {
    const h = await buildSignHeaders('GET', 'https://x/api', '', 'mh_ck_abc', subtleHmac, () => 'n1');
    assert.ok(h);
    assert.match(h!.s, /^[a-f0-9]{64}$/);
  });
});
