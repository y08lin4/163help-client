import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { hbState } from '../dist/heartbeat.js';

describe('hbState（心跳判定纯函数）', () => {
  test('lastAt=0（无首心跳）→ ok（由 grace 窗口单独判定）', () => {
    assert.equal(hbState(0, Date.now(), 45000), 'ok');
  });
  test('距上次心跳 > stall → stall（触发 heartbeat_lost 放弃）', () => {
    const last = 1000;
    assert.equal(hbState(last, last + 2000, 45000), 'ok');
    assert.equal(hbState(last, last + 46000, 45000), 'stall');
  });
  test('边界：恰好等于 stall 不算超时', () => {
    const last = 1000;
    assert.equal(hbState(last, last + 45000, 45000), 'ok');
  });
});