/**
 * content script：注入面板 + PlatformAdapter（chrome.storage.local）+ 播放器适配
 * 与 userscript 端同构（仅存储/生命周期适配不同）；构建时由 esbuild 打包进 content.js
 */
import { ClientRuntime } from '../../../packages/core/src/index.ts';
import { mountPanel } from '../../../packages/ui/src/index.ts';

const BASE = 'https://163music.linyu.qzz.io';

const store = {
  async get(key: string) { return (await chrome.storage.local.get(key))[key]; },
  async set(key: string, v: unknown) { await chrome.storage.local.set({ [key]: v }); },
};

const storage = {
  getToken: () => { let t = ''; void store.get('mh_token').then((v) => { t = String(v ?? ''); }); return t; },
  setToken: (t: string) => { void store.set('mh_token', t); },
  clearToken: () => { void store.set('mh_token', ''); },
  getExpires: () => 0,
  setExpires: () => {},
};

const adapter = {
  clientType: 'extension', version: '5.0.3', storage,
  probeNetwork: async () => true, hasPage: true,
  onLifecycle: (h: 'freeze' | 'resume', cb: () => void) => {
    if (h === 'freeze') {
      window.addEventListener('pagehide', cb, { capture: true });
      document.addEventListener('visibilitychange', () => { if (document.hidden) cb(); }, { capture: true });
    } else {
      document.addEventListener('visibilitychange', () => { if (!document.hidden) cb(); }, { capture: true });
    }
  },
};

async function api<T>(method: string, path: string, body?: unknown, token = ''): Promise<{ status: number; payload: T | null }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method, headers: { ...headers, 'X-Music-Helper-Version': '5.0.3', 'X-Client-Type': 'extension' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = res.status === 200 ? await res.json().catch(() => null) : null;
  return { status: res.status, payload };
}

const transport = {
  next: async (token: string) => api<import('@163help/core').NextPayload>('POST', '/api/next', {}, token),
  finish: async (token: string, input: unknown) => api('POST', '/api/play/finish', input, token),
  abandon: async (token: string, reason: string, detail: string) => { await api('POST', '/api/play/abandon', { reason, detail }, token); },
  heartbeat: async (token: string, input: unknown) => (await api('POST', '/api/play/heartbeat', input, token)).status === 200,
  refresh: async (token: string) => (await api('POST', '/auth/refresh', { token }, '')).payload,
  me: () => api('GET', '/api/me'),
  sendLog: async (p: unknown) => { await api('POST', '/api/client/log', p); },
};

const player = {
  async play(musicId: string): Promise<boolean> {
    const id = Number(String(musicId).replace(/^song:/, ''));
    const anyWin = window as unknown as Record<string, unknown>;
    try {
      if (typeof anyWin.player === 'object' && anyWin.player && typeof (anyWin.player as { playById?: Function }).playById === 'function') {
        (anyWin.player as { playById: Function }).playById({ id });
        return true;
      }
      location.hash = `/song?id=${id}`;
      return true;
    } catch { return false; }
  },
  stop() {},
  onProgress(cb: (playedMs: number, positionMs: number, durationMs: number) => void) {
    setInterval(() => {
      const audio = (document.querySelector('audio[src]') || document.querySelector('audio')) as HTMLAudioElement | null;
      if (!audio || !audio.currentTime) return;
      cb(Math.round(audio.currentTime * 1000), Math.round(audio.currentTime * 1000), Math.round((audio.duration || 0) * 1000));
    }, 500);
  },
};

const runtime = new ClientRuntime({ adapter, transport, player } as never);
const panel = mountPanel();

runtime.bus.on('auth:user', (u) => panel.setState({ title: u ? `已登录 · ${u.displayName}` : '未登录', dotOff: !u }));
runtime.bus.on('job:current', (j) => panel.setState({ task: j ? { name: j.musicName, timeText: '0:00 / 0:00', playRatio: 0 } : null }));
runtime.bus.on('log:append', () => panel.setState({ logCount: Math.min(99, Number((panel.state?.logCount ?? 0)) + 1) }));

void runtime.start(true);
