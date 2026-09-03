/**
 * content script：注入面板 + PlatformAdapter（chrome.storage.local）+ 播放器适配
 * 与 userscript 端同构（仅存储/生命周期适配不同）；构建时由 esbuild 打包进 content.js
 */
import { ClientRuntime } from '../../../packages/core/src/index.ts';
import { mountPanel } from '../../../packages/ui/src/index.ts';

const BASE = 'https://163music.linyu.qzz.io';
const BASE_HOST = new URL(BASE).host;

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
  clientType: 'extension', version: '5.1', storage,
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
    method, headers: { ...headers, 'X-Music-Helper-Version': '5.1', 'X-Client-Type': 'extension' },
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
  // /api/client/log 是 withAuth 登录态，必须带 Authorization（token 从存储取）
  sendLog: async (p: unknown) => { const t = await store.get('mh_token'); return api('POST', '/api/client/log', p, String(t ?? '')); },
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

/* ---------- 快照（mh_snapshot，30s + 事件触发写入；值变化才写） ---------- */
const snap = { online: false, todaySec: 0, todayGoal: 9000, taskName: '', taskPos: '', helped: 0, helpedTotal: 26 };
let snapKey = '';
async function snapshot() {
  const cur = JSON.stringify(snap);
  if (cur === snapKey) return; // 值未变，避免垃圾写
  snapKey = cur;
  await store.set('mh_snapshot', { ...snap });
}
setInterval(() => void snapshot(), 30_000);

function fmt(ms: number): string {
  const s = Math.floor((ms || 0) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* ---------- core 事件 → 面板状态 & 快照 ---------- */
runtime.bus.on('auth:user', (u) => panel.setState({ title: u ? `已登录 · ${u.displayName}` : '未登录', dotOff: !u }));
runtime.bus.on('auth:status', (s) => { snap.online = s === 'valid'; void snapshot(); });
runtime.bus.on('job:current', (j) => {
  snap.taskName = j ? j.musicName : '';
  snap.taskPos = j ? fmt(j.playedMs) : '';
  panel.setState({ task: j ? { name: j.musicName, timeText: `${fmt(j.playedMs)} / ${fmt(j.targetMs)}`, playRatio: j.targetMs > 0 ? j.playedMs / j.targetMs : 0 } : null });
  void snapshot();
});
runtime.bus.on('job:progress', (p) => {
  snap.taskPos = fmt(p.playedMs);
  panel.setState({ task: { name: panel.state.taskName ?? snap.taskName ?? '—', timeText: fmt(p.playedMs), playRatio: 0 } });
  void snapshot();
});
runtime.bus.on('limits:updated', (s) => {
  snap.todaySec = s.helpedToday; snap.todayGoal = s.helpedLimit;
  snap.helped = s.receivedToday; snap.helpedTotal = s.receivedLimit;
  panel.setState({
    help: s.helpedToday, limit: s.helpedLimit,
    ratio: s.helpedLimit > 0 ? s.helpedToday / s.helpedLimit : 0,
    recv: s.receivedToday, recLimit: s.receivedLimit,
  });
  void snapshot();
});
runtime.bus.on('heartbeat:tick', (t) => {
  snap.online = true;
  panel.setState({ hbText: `${Math.max(1, Math.round(t.intervalMs / 1000))}s` });
  void snapshot();
});
runtime.bus.on('log:append', () => panel.setState({ logCount: Math.min(99, Number((panel.state?.logCount ?? 0)) + 1) }));

/* ---------- 错误上报（三通道之一：页面全局 error / unhandledrejection） ---------- */
// 仅当 mh_setting_logReport !== false 才发（默认开）
const logReportOff = store.get('mh_setting_logReport').then((v) => v === false);
const reportLast: Record<string, number> = {};
function sanitize(m: string): string {
  return String(m ?? '')
    .replace(/MUSIC_U=[^;&\s"'`]+/gi, 'MUSIC_U=***')
    .replace(/mh_ck_[A-Za-z0-9_-]+/gi, 'mh_ck_***')
    .replace(/Bearer\s+\S+/gi, 'Bearer ***')
    .replace(/[?&]token=[^&\s"'`]+/gi, 'token=***');
}
// 只上报本脚本错误（宁可少报不可误报）：按扩展 id / 我们的域名 / 代码标识过滤
function looksOurs(t: string): boolean {
  const s = String(t ?? '');
  return /chrome-extension:\/\//.test(s) || s.includes(BASE_HOST) || /mh_[a-z_]+/i.test(s)
    || s.includes('ClientRuntime') || s.includes('mh-panel') || s.includes('@163help/core');
}
function reportError(ev: string, err: unknown, trace: string) {
  const fromErr = err instanceof Error && looksOurs(err.message + ' ' + String(err.stack ?? ''));
  if (!looksOurs(trace) && !fromErr) return;
  let msg = '';
  if (err instanceof Error) msg = err.message || String(err);
  else if (typeof err === 'string') msg = err;
  else if (err && typeof err === 'object') msg = String((err as { message?: unknown }).message ?? err);
  else msg = String(err);
  if (!msg) return;
  const now = Date.now();
  if (reportLast[ev] && now - reportLast[ev] < 5 * 60_000) return; // 同 event 5min 去抖
  reportLast[ev] = now;
  void logReportOff.then((off) => {
    if (off) return;
    void transport.sendLog({ level: 'error', event: ev, msg: sanitize(msg), context: { page: location.href, rurl: location.pathname } }).catch(() => {});
  });
}
window.addEventListener('error', (e) => reportError('client_error', e.error ?? e.message, `${String(e.filename ?? '')} ${String(e.message ?? '')}`));
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason;
  if (r instanceof Error) reportError('promise_reject', r, `${String(r.stack ?? '')} ${String(r.message ?? '')}`);
});

void runtime.start(true);
