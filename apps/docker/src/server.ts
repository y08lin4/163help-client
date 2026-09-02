/**
 * docker 管理端（容器内 :3000；宿主映射 13000）
 * - GET /            仪表页（统一设计系统：白卡红标 + 心跳迷你折线 + 实时日志流）
 * - POST /api/login  UI_PASSWORD 登录（签发内存 session + HttpOnly Cookie）
 * - GET /api/state   状态快照（JSON）；POST /api/config 保存 Cookie/mh_ck_
 */
import http from 'node:http';
import crypto from 'node:crypto';
import { buildPage } from './page.ts';

function cookieVal(header: string | string[] | undefined, name: string): string {
  const raw = Array.isArray(header) ? header.join('; ') : (header || '');
  const m = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1]!.trim() : '';
}

export function createStatusServer({ port, state }: { port: number; state: { [k: string]: any } }) {
  const sessions = new Map<string, number>(); // token -> exp
  const PASSWORD = process.env.UI_PASSWORD || '';
  if (!PASSWORD) { console.error('[server] UI_PASSWORD 未设置，拒绝启动'); process.exit(1); }

  const tokenOK = (t: string): boolean => {
    const exp = sessions.get(t) || 0;
    if (exp && exp > Date.now()) { sessions.set(t, Date.now() + 2 * 3600_000); return true; }
    return false;
  };

  const server = http.createServer(async (req, res) => {
    const body = async () => new Promise<string>((resolve) => { let d = ''; req.on('data', (c: any) => (d += c)); req.on('end', () => resolve(d)); });

    try {
      if (req.method === 'POST' && req.url === '/api/login') {
        const { password } = JSON.parse((await body()) || '{}');
        if (password === PASSWORD) {
          const t = crypto.randomBytes(24).toString('hex');
          sessions.set(t, Date.now() + 2 * 3600_000);
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Set-Cookie': `mh_ui=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=7200`,
          });
          res.end(JSON.stringify({ ok: true }));
          return;
        }
        res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false })); return;
      }
      if (req.method === 'GET' && req.url === '/') {
        const cookieAuthed = tokenOK(cookieVal(req.headers.cookie, 'mh_ui'));
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(buildPage({ authed: cookieAuthed }));
        return;
      }
      if (req.url?.startsWith('/api/')) {
        const okAuth = tokenOK(cookieVal(req.headers.cookie, 'mh_ui')) ||
          tokenOK((req.headers['x-ui-token'] || '') as string);
        if (!okAuth) { res.writeHead(401); res.end(JSON.stringify({ error: 'unauthorized' })); return; }
        if (req.method === 'GET' && req.url === '/api/state') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            uptime: Math.floor((Date.now() - state.startedAt) / 1000),
            version: '5.0.1',
            job: state.job, hbIntervals: state.hbIntervals,
            helpUsed: state.helpUsed, helpLimit: state.helpLimit,
            recv: state.recv, recvLimit: state.recvLimit,
            logs: state.logs.slice(-50),
          })); return;
        }
        if (req.method === 'POST' && req.url === '/api/config') {
          const c = JSON.parse((await body()) || '{}');
          if (state.onConfig) state.onConfig(c);
          res.writeHead(200); res.end(JSON.stringify({ ok: true })); return;
        }
      }
      res.writeHead(404); res.end('nf');
    } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: String(e) })); }
  });
  server.listen(port, '0.0.0.0');
  return server;
}
