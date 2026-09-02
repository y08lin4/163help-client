/**
 * 心跳引擎（严格协议 §4）：
 * - 播放期间每 10s 上报
 * - 首心跳：领取后 30s 内必须出现，否则 abandon('play_start_fail')
 * - 中断：距上次心跳 >45s → abandon('heartbeat_lost')
 * - freeze/resume：冻结前补帧；恢复后任务仍有效→续听；已过期→自动重接
 * - 无心跳 = 无效播放（服务端不补结算，客户端明示重听）
 */
import { EventBus } from './events.js';
import type { HeartbeatInput, PlatformAdapter } from './types.js';

export const HEARTBEAT_INTERVAL_MS = 10_000;
export const FIRST_HB_GRACE_MS = 30_000;
export const HB_STALL_MS = 45_000;

/** 纯函数：心跳当前状态（供单测与 UI 提示；无 timers） */
export function hbState(lastAt: number, now: number, stallMs: number): 'ok' | 'stall' {
  return lastAt > 0 && now - lastAt > stallMs ? 'stall' : 'ok';
}

export interface HeartbeatEvents {
  onAbandon(reason: 'play_start_fail' | 'heartbeat_lost', detail: string): void;
  onResume(): void; // 恢复续听
}

export class HeartbeatEngine {
  private timer: ReturnType<typeof setInterval> | null = null;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastAt = 0;
  private jobId = '';
  private stopped = true;
  private opts: { firstHbGraceMs: number; hbStallMs: number; intervalMs: number };

  constructor(
    private bus: EventBus,
    private api: { heartbeat(input: HeartbeatInput): Promise<boolean> },
    private adapter: PlatformAdapter,
    private events: HeartbeatEvents,
    opts: Partial<{ firstHbGraceMs: number; hbStallMs: number; intervalMs: number }> = {},
  ) {
    this.opts = {
      firstHbGraceMs: opts.firstHbGraceMs ?? FIRST_HB_GRACE_MS,
      hbStallMs: opts.hbStallMs ?? HB_STALL_MS,
      intervalMs: opts.intervalMs ?? HEARTBEAT_INTERVAL_MS,
    };
    this.adapter.onLifecycle?.('freeze', () => { void this.flush().catch(() => {}); });
    this.adapter.onLifecycle?.('resume', () => { void this.onResumeLifecycle(); });
  }

  get job(): string { return this.jobId; }

  start(jobId: string): void {
    this.stop();
    this.jobId = jobId;
    this.stopped = false;
    // 首心跳宽限
    this.graceTimer = setTimeout(() => {
      if (!this.stopped && this.lastAt === 0) {
        this.events.onAbandon('play_start_fail', `首心跳 30s 内未出现`);
      }
    }, this.opts.firstHbGraceMs);
    this.timer = setInterval(() => { void this.tick(); }, this.opts.intervalMs);
  }

  /** 播放心跳（播放器回调） */
  async pulse(playedMs: number, positionMs: number, durationMs: number, monotonic: boolean): Promise<void> {
    if (this.stopped) return;
    this.lastAt = Date.now();
    await this.flush(playedMs, positionMs, durationMs, monotonic);
  }

  private async flush(playedMs = 0, positionMs = 0, durationMs = 0, monotonic = true): Promise<void> {
    if (this.stopped || !this.jobId) return;
    const ok = await this.api.heartbeat({
      jobId: this.jobId, playedMs, positionMs, durationMs, monotonic,
    });
    if (ok) {
      this.bus.emit('heartbeat:tick', { jobId: this.jobId, intervalMs: HEARTBEAT_INTERVAL_MS, lastAtMs: Date.now() });
    }
  }

  private async tick(): Promise<void> {
    if (this.stopped || !this.jobId) return;
    if (this.lastAt === 0) return; // 首心跳前由 graceTimer 判定
    if (Date.now() - this.lastAt > this.opts.hbStallMs) {
      this.events.onAbandon('heartbeat_lost', `距上次心跳 ${Math.round((Date.now() - this.lastAt) / 1000)}s`);
      return;
    }
    await this.flush();
  }

  private async onResumeLifecycle(): Promise<void> {
    if (this.stopped || !this.jobId) return;
    // 恢复：tick 会立即续听；事件告知 UI
    this.bus.emit('heartbeat:tick', { jobId: this.jobId, intervalMs: 0, lastAtMs: Date.now() });
    this.events.onResume();
  }

  stop(): void {
    this.stopped = true;
    this.jobId = '';
    this.lastAt = 0;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.graceTimer) { clearTimeout(this.graceTimer); this.graceTimer = null; }
  }
}
