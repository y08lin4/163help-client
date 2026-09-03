/**
 * 环形日志 + 自动上报策略（§8）
 * - 内存环形 200 条（脱敏后）
 * - error 立即上报；warn 聚类 ≤1 条/5 分钟；info 仅本地
 * - 断网进本地队列（≤20），恢复后 10 分钟合并补报
 * - 上报前置脱敏（token/cookie/mh_ck_/MUSIC_U → ***）
 */
import type { ClientLogPayload, LogLevel } from './types.js';

export interface LogSink {
  (payload: ClientLogPayload): Promise<void>; // 返回成功与否（失败进队列）
}

const RING_SIZE = 200;
const WARN_COOLDOWN_MS = 5 * 60_000;
const BACKLOG_MAX = 20;
const BACKLOG_FLUSH_MS = 10 * 60_000;

const REDACT_RE = [
  /mh_ck_[A-Za-z0-9_-]+/g,
  /MUSIC_U=[^;&\s"'`]+/g,
  /[?&]token=[^&\s"'`]+/g,
];

export function redact(text: string): string {
  let out = text;
  for (const re of REDACT_RE) out = out.replace(re, '***');
  return out;
}

export class ClientLogger {
  private ring: ClientLogPayload[] = [];
  private backlog: ClientLogPayload[] = [];
  private lastWarnAt = new Map<string, number>();
  private lastFlushAt = 0;
  private sink: LogSink;

  constructor(
    sink: LogSink,
    private opts: { maxRing?: number; warnCooldownMs?: number; onAppend?: (p: ClientLogPayload) => void } = {},
  ) {
    this.sink = sink;
  }

  push(level: LogLevel, event: string, msg: string, context?: ClientLogPayload['context']): void {
    const payload: ClientLogPayload = {
      level, event,
      msg: redact(String(msg)),
      context: context ? Object.fromEntries(Object.entries(context).map(([k, v]) => [k, typeof v === 'string' ? redact(v) : v])) : undefined,
      clientVersion: '', // 由 adapter 填充
      clientType: 'userscript',
    };
    this.ring.push(payload);
    const ringSize = this.opts.maxRing ?? RING_SIZE;
    if (this.ring.length > ringSize) this.ring.splice(0, this.ring.length - ringSize);
    this.opts.onAppend?.(payload); // B5：propagate 到 core bus → 面板 logCount
    void this.schedule(payload);
  }

  private async schedule(p: ClientLogPayload): Promise<void> {
    if (p.level === 'error') {
      await this.trySend(p);
    } else if (p.level === 'warn') {
      const now = Date.now();
      const last = this.lastWarnAt.get(p.event) ?? 0;
      const cooldown = this.opts.warnCooldownMs ?? WARN_COOLDOWN_MS;
      if (now - last >= cooldown) {
        this.lastWarnAt.set(p.event, now);
        await this.trySend(p);
      }
    } // info: 本地环
  }

  private async trySend(p: ClientLogPayload): Promise<void> {
    try {
      await this.sink(p);
    } catch {
      if (this.backlog.length < BACKLOG_MAX) this.backlog.push(p);
      this.maybeFlushBacklog();
    }
  }

  private maybeFlushBacklog(): void {
    const now = Date.now();
    if (this.backlog.length === 0 || now - this.lastFlushAt < BACKLOG_FLUSH_MS) return;
    void (async () => {
      const batch = this.backlog.splice(0);
      for (const p of batch) { try { await this.sink(p); } catch { this.backlog.push(p); break; } }
      this.lastFlushAt = now;
    })();
  }

  /** 面板「复制诊断信息」：脱敏环形日志 + 概要 */
  dump(): string {
    const lines = this.ring.map((p) => `[${new Date().toISOString()}] ${p.level.toUpperCase()} ${p.event} ${p.msg}`);
    return ['====== 163help client diagnostic ======', ...lines].join('\n');
  }

  clear(): void { this.ring = []; }
}
