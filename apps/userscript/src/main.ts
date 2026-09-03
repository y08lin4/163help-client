/**
 * 油猴端入口：mount <mh-panel> + PlatformAdapter(GM 存储) + ApiTransport + 网易云播放器适配
 * 构建：esbuild bundle → dist/music-help.user.js（单文件，CI 执行；本地 node --check）
 */
import { ClientRuntime } from '../../../packages/core/src/index.ts';
import { mountPanel } from '../../../packages/ui/src/index.ts';

const GM: any = globalThis;

const BASE = 'https://163music.linyu.qzz.io';

/* ---------- 存储适配（GM_* → Tampermonkey 存储） ---------- */
const storage = {
  getToken: () => String(GM.GM_getValue('musicHelperToken', '') || ''),
  setToken: (t: string) => GM.GM_setValue('musicHelperToken', t),
  clearToken: () => GM.GM_setValue('musicHelperToken', ''),
  getExpires: (k: 'access' | 'refresh') => Number(GM.GM_getValue(`musicHelper${k === 'access' ? 'Access' : 'Refresh'}ExpiresAt`, '') || 0) || 0,
  setExpires: (k: 'access' | 'refresh', v: number) => GM.GM_setValue(`musicHelper${k === 'access' ? 'Access' : 'Refresh'}ExpiresAt`, String(new Date(v).toISOString())),
};

/* ---------- 平台适配 ---------- */
const adapter = {
  clientType: 'userscript',
  version: '5.1',
  storage,
  probeNetwork: async () => true,
  hasPage: true,
  onLifecycle: (h: 'freeze' | 'resume', cb: () => void) => {
    if (h === 'freeze') {
      window.addEventListener('pagehide', cb, { capture: true });
      document.addEventListener('visibilitychange', () => { if (document.hidden) cb(); }, { capture: true });
    } else {
      const onVis = () => { if (!document.hidden) cb(); };
      document.addEventListener('visibilitychange', onVis, { capture: true });
    }
  },
};

/* ---------- API 传输（fetch + 签名 + 401→refresh→重试） ---------- */
import { buildSignHeaders, subtleHmac, browserNonce } from '../../../packages/core/src/index.ts';

async function api<T>(method: string, path: string, body?: unknown, token = storage.getToken()): Promise<{ status: number; payload: T | null }> {
  const fullUrl = BASE + path;
  const rawBody = body === undefined ? '' : JSON.stringify(body);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const sign = token ? await buildSignHeaders(method, fullUrl, rawBody, token, subtleHmac, browserNonce) : null;
  if (sign) { headers['X-MH-Nonce'] = sign.a; headers['X-MH-Ts'] = sign.t; headers['X-MH-Sig'] = sign.s; }
  const res = await fetch(fullUrl, { method, headers: { ...headers, 'X-Music-Helper-Version': '5.1' }, body: body === undefined ? undefined : rawBody });
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

/* ---------- 播放器适配：网易云网页播放器（读 audio 元素） ---------- */
const player = {
  async play(musicId: string, _durationMs: number): Promise<boolean> {
    const bad = musicId.replace(/^song:/, '');
    // 尝试网易云内置播放：通过 hash 的 player 接口
    const anyWin = unsafeWindow as Record<string, unknown>;
    try {
      if (typeof anyWin.player === 'object' && anyWin.player && typeof (anyWin.player as { playById?: Function }).playById === 'function') {
        (anyWin.player as { playById: Function }).playById({ id: Number(bad) });
        return true;
      }
      // 兜底：直接在页面触发 song/:id 路由（网易云 SPA）
      location.href = `https://music.163.com/#/song?id=${bad}`;
      return true;
    } catch {
      return false;
    }
  },
  stop() { /* 播放器不强制停（停掉由网易云控制） */ },
  onProgress(cb: (playedMs: number, positionMs: number, durationMs: number) => void) {
    setInterval(() => {
      const audio = (document.querySelector('audio[src]') || document.querySelector('audio')) as HTMLAudioElement | null;
      if (!audio || !audio.currentTime) return;
      cb(Math.round(audio.currentTime * 1000), Math.round(audio.currentTime * 1000), Math.round((audio.duration || 0) * 1000));
    }, 500);
  },
};

/* ---------- 启动 ---------- */
const runtime = new ClientRuntime({ adapter, transport, player } as never);
const panel = mountPanel();

// core 事件 → 面板状态
runtime.bus.on('auth:user', (u) => {
  panel.setState({ title: u ? `已登录 · ${u.displayName}` : '未登录', dotOff: !u });
});
runtime.bus.on('limits:updated', (s) => panel.setState({
  help: s.helpedToday, limit: s.helpedLimit, ratio: s.helpedLimit > 0 ? s.helpedToday / s.helpedLimit : 0,
  recv: s.receivedToday, recLimit: s.receivedLimit, recRatio: s.receivedLimit > 0 ? s.receivedToday / s.receivedLimit : 0,
}));
runtime.bus.on('job:current', (j) => panel.setState({ task: j ? { name: j.musicName, timeText: '0:00 / 0:00', playRatio: 0 } : null }));
runtime.bus.on('job:progress', (p) => panel.setState({ task: { name: panel.state.taskName ?? '—', timeText: fmt(p.playedMs), playRatio: 0 } }));
runtime.bus.on('log:append', () => panel.setState({ logCount: Math.min(99, Number((panel.state.logCount ?? 0)) + 1) }));

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* ---------- 错误上报（三通道之一：页面全局 error / unhandledrejection） ---------- */
const BASE_HOST = new URL(BASE).host;
const reportLast: Record<string, number> = {};
function sanitize(m: string): string {
  return String(m ?? '')
    .replace(/MUSIC_U=[^;&\s"'`]+/gi, 'MUSIC_U=***')
    .replace(/mh_ck_[A-Za-z0-9_-]+/gi, 'mh_ck_***')
    .replace(/Bearer\s+\S+/gi, 'Bearer ***')
    .replace(/[?&]token=[^&\s"'`]+/gi, 'token=***');
}
// 只上报本脚本错误（宁可少报不可误报）：按我们的域名 / 代码标识过滤
function looksOurs(t: string): boolean {
  const s = String(t ?? '');
  return s.includes(BASE_HOST) || /mh_[a-z_]+/i.test(s)
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
  // 开关：GM 存储 mh_setting_logReport（默认开）
  if (GM.GM_getValue('mh_setting_logReport', true) === false) return;
  void transport.sendLog({ level: 'error', event: ev, msg: sanitize(msg), context: { page: location.href, rurl: location.pathname } }).catch(() => {});
}
window.addEventListener('error', (e) => reportError('client_error', e.error ?? e.message, `${String(e.filename ?? '')} ${String(e.message ?? '')}`));
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason;
  if (r instanceof Error) reportError('promise_reject', r, `${String(r.stack ?? '')} ${String(r.message ?? '')}`);
});

void runtime.start(true);

// 暴露给页面/调试
unsafeWindow.__mhRuntime = runtime;
