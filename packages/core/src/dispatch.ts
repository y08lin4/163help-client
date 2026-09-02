/**
 * 任务状态机：next / finish / abandon 的本地编排（防重入、防并发双发）
 * 状态：idle → fetching → playing → (settle) → idle
 * finish 被拒（job_expired 等）→ 明示并进入下一单（无宽容语义）
 */
import { EventBus } from './events.js';
import type { ApiResult, FinishInput, JobPhase, NextPayload } from './types.js';

export interface DispatchDeps {
  next(): Promise<ApiResult<NextPayload>>;
  finish(input: FinishInput): Promise<ApiResult<{ settled?: boolean }>>;
  abandon(reason: string, detail: string): Promise<void>;
  /** 播放开始回调：由 UI/播放器拉起心跳 */
  onPlaying(job: { jobId: string; musicName: string; targetMs: number }): void;
  /** 结算失败提示（403/过期等）——明示「无心跳未结算，请重新听」 */
  onSettleFailed(code: string, msg: string): void;
}

export interface CurrentJob {
  jobId: string;
  musicName: string;
  targetMs: number;
  playedMs: number;
}

export class JobStateMachine {
  phase: JobPhase = 'idle';
  current: CurrentJob | null = null;
  private busy = false; // 防重入

  constructor(private deps: DispatchDeps, private bus: EventBus) {}

  private setPhase(p: JobPhase): void {
    this.phase = p;
    this.bus.emit('job:phase', p);
  }

  /** 领取下一单（空闲时调用；防并发） */
  async fetchNext(): Promise<NextPayload | null> {
    if (this.busy || this.phase !== 'idle') return null;
    this.busy = true;
    this.setPhase('fetching');
    try {
      const r = await this.deps.next();
      if (r.status === 200 && r.payload && r.payload.jobId && r.payload.musicId) {
        this.current = {
          jobId: r.payload.jobId,
          musicName: r.payload.owner?.displayName ? '' : String(r.payload.musicId),
          targetMs: r.payload.targetDurationMs ?? 0,
          playedMs: 0,
        };
        this.setPhase('playing');
        this.bus.emit('job:current', this.current);
        this.deps.onPlaying(this.current);
        return r.payload;
      }
      // noTarget / 无单：回 idle（reason 由调用方展示）
      this.setPhase('idle');
      return r.payload ?? null;
    } finally {
      this.busy = false;
    }
  }

  updateProgress(playedMs: number): void {
    if (!this.current) return;
    this.current.playedMs = Math.max(this.current.playedMs, playedMs);
    this.bus.emit('job:progress', { jobId: this.current.jobId, playedMs, positionMs: playedMs });
  }

  /** 播放完成提交 */
  async submitFinish(input: FinishInput): Promise<'settled' | 'rejected' | 'error'> {
    if (!this.current) return 'error';
    try {
      const r = await this.deps.finish(input);
      if (r.status === 200 || r.payload?.settled) {
        this.clear();
        return 'settled';
      }
      if (r.status === 403 || r.payload === null) {
        this.deps.onSettleFailed(String(r.payload && 'error' in r.payload ? (r.payload as { error?: string }).error : 'rejected'), String(r.error ?? ''));
      }
      this.clear();
      return r.status === 403 ? 'rejected' : 'error';
    } catch {
      this.clear();
      return 'error';
    }
  }

  /** 主动放弃（30s 无首心跳 / 45s 心跳中断 / 播放器错误） */
  async abandon(reason: string, detail: string): Promise<void> {
    const job = this.current;
    this.setPhase('abandoning');
    try {
      if (job) await this.deps.abandon(reason, detail);
    } finally {
      this.clear();
    }
  }

  private clear(): void {
    this.current = null;
    this.setPhase('idle');
    this.bus.emit('job:current', null);
  }
}
