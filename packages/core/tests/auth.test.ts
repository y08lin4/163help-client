import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AuthManager } from '../dist/auth.js';
import { EventBus } from '../dist/events.js';

function makeAdapter() {
  let tok = ''; const exps: Record<string, number> = {};
  return {
    clientType: 'userscript', version: '5.1',
    storage: {
      getToken: () => tok, setToken: (t: string) => { tok = t; },
      clearToken: () => { tok = ''; },
      getExpires: (k: string) => exps[k] ?? 0,
      setExpires: (k: string, v: number) => { exps[k] = v; },
    },
    probeNetwork: async () => true, hasPage: true,
  };
}

describe('AuthManager', () => {
  let a: AuthManager; let adapter: ReturnType<typeof makeAdapter>;
  let refreshOk: unknown;

  beforeEach(() => {
    adapter = makeAdapter();
    refreshOk = { token: 't2', access_expires_at: new Date(Date.now() + 86400_000).toISOString(), refresh_expires_at: new Date(Date.now() + 86400_000).toISOString() };
    a = new AuthManager(adapter as never, {
      refresh: async () => refreshOk as never,
      me: async () => ({ status: 200, payload: { displayName: 'u', credits: 1 } }),
    } as never, new EventBus());
  });

  test('login 存入 token 并置 valid', () => {
    a.acceptSession({ token: 't1', access_expires_at: new Date(Date.now() + 86400_000).toISOString(), refresh_expires_at: new Date(Date.now() + 86400_000).toISOString() });
    assert.equal(a.status, 'valid');
    assert.equal(adapter.storage.getToken(), 't1');
  });

  test('token 临近过期时 ensureToken 会 refresh', async () => {
    a.acceptSession({ token: 't1', access_expires_at: new Date(Date.now() + 5000).toISOString(), refresh_expires_at: new Date(Date.now() + 86400_000).toISOString() });
    const t = await a.ensureToken();
    assert.equal(t, 't2');
  });

  test('401 且 refresh 失败 → clearSession(logged_out)', async () => {
    a.acceptSession({ token: 't1', access_expires_at: new Date(Date.now() + 86400_000).toISOString(), refresh_expires_at: new Date(Date.now() + 86400_000).toISOString() });
    refreshOk = null;
    const ok = await a.onUnauthorized();
    assert.equal(ok, false);
    assert.equal(a.status, 'logged_out');
    assert.equal(adapter.storage.getToken(), '');
  });
});
