/**
 * ClientRuntime：core 编排器（把 auth/heartbeat/dispatch/logger 串成完整运行循环）
 * 各端仅需：实现 PlatformAdapter + ApiTransport + 播放器回调 → 交给 runtime。
 */
import { AuthManager } from './auth.js';
import { JobStateMachine, type CurrentJob } from './dispatch.js';
import { HeartbeatEngine } from './heartbeat.js';
import { ClientLogger } from './logger.js';
import { EventBus } from './events.js';
import type { ApiResult, ClientType, FinishInput, MePayload, NextPayload, PlatformAdapter } from './types.js';

/** 端侧必须提供的四件套 */
export interface RuntimeDeps {
  adapter: PlatformAdapter;
  transport: {
    next(token: string): Promise<ApiResult<NextPayload>>;
    finish(token: string, input: FinishInput): Promise<ApiResult<{ settled?: boolean }>>;
    abandon(token: string, reason: string, detail: string): Promise<void>;
    heartbeat(token: string, input: { jobId: string; playedMs: number; positionMs: number; durationMs: number; monotonic: boolean }): Promise<boolean>;
    refresh(token: string): Promise<import('./types.js').LoginPayload | null>;
    me(): Promise<ApiResult<MePayload>>;
    sendLog(payload: import('./types.js').ClientLogPayload): Promise<void>;
  };
  player: {
    /** 命令播放器开始播 target（返回 false=加载失败，走放弃分支） */
    play(musicId: string, durationMs: number, ownerName: string): Promise<boolean>;
    /** 播放器停止（放弃/结算后） */
    stop(): void;
    /** 订阅播放进度（接入心跳 pulse） */
    onProgress(cb: (playedMs: number, positionMs: number, durationMs: number) => void): void;
  };
}

export class ClientRuntime {
  readonly bus = new EventBus();
  readonly auth: AuthManager;
  readonly job: JobStateMachine;
  readonly heart: HeartbeatEngine;
  readonly log: ClientLogger;

  constructor(private deps: RuntimeDeps) {
    this.log = new ClientLogger((p) => this.deps.transport.sendLog(p), {
      // B5：log:append 真正发射（每次 log.push → core bus → 面板 logCount）
      // 载荷保持 msg/ts 兼容既有端点，额外附 text/event 供新消费方
      onAppend: (p) => this.bus.emit('log:append', { level: p.level, ts: Date.now(), msg: p.msg, text: p.msg, event: p.event }),
    });
    this.auth = new AuthManager(deps.adapter, {
      refresh: (t) => deps.transport.refresh(t),
      me: () => deps.transport.me(),
      login: async () => null, // 登录走页面 oauth
    }, this.bus);

    this.job = new JobStateMachine({
      next: async () => {
        const token = await this.auth.ensureToken();
        if (!token) return { status: 401, payload: null, error: 'no_token' };
        return this.deps.transport.next(token);
      },
      finish: async (input) => {
        const token = await this.auth.ensureToken();
        if (!token) return { status: 401, payload: null, error: 'no_token' };
        return this.deps.transport.finish(token, input);
      },
      abandon: async (r, d) => {
        const token = await this.auth.ensureToken();
        if (token) { try { await this.deps.transport.abandon(token, r, d); } catch { /* 静默 */ } }
        this.log.push('warn', 'job_abandon', r, { detail: d });
      },
      onPlaying: (job) => {
        this.heart.start(job.jobId);
        void this.deps.player.play(job.musicName, job.targetMs, '');
      },
      onSettleFailed: (code, msg) => {
        this.log.push('error', 'settle_failed', msg, { code });
        this.bus.emit('job:phase', 'settle_failed');
      },
    }, this.bus);

    this.heart = new HeartbeatEngine(this.bus, {
      heartbeat: async (input) => {
        const token = await this.auth.ensureToken();
        if (!token) return false;
        try { return await this.deps.transport.heartbeat(token, input); } catch { return false; }
      },
    }, deps.adapter, {
      onAbandon: (reason, detail) => {
        this.log.push('error', 'heartbeat_abandon', reason, { detail });
        void this.job.abandon(reason, detail);
      },
      onResume: () => this.log.push('info', 'hb_resume', '恢复续听'),
    });

    deps.player.onProgress((playedMs, positionMs, durationMs) => {
      this.job.updateProgress(playedMs);
      void this.heart.pulse(playedMs, positionMs, durationMs, true);
    });

    // UI 镜像事件
    this.bus.on('job:current', (j: CurrentJob | null) => { if (j) this.log.push('info', 'job_start', j.musicName); });
  }

  async start(autostart: boolean): Promise<void> {
    await this.auth.refreshUser();
    if (autostart && this.auth.hasToken()) {
      void this.cycle();
    }
  }

  /** 主循环：领单 → 播 → 结束/失败 → 下一单（带 3s 间隔与退出） */
  private async cycle(): Promise<void> {
    while (true) {
      const p = await this.job.fetchNext();
      if (p && p.noTargetReason) {
        this.log.push('info', 'no_target', String(p.noTargetReason));
        await sleep(3000);
        continue;
      }
      await sleep(3000);
    }
  }

  private _sessionAccepted = false;
  /** 登录页回调（oauth 成功后） */
  acceptSession(p: import('./types.js').LoginPayload): void {
    this.auth.acceptSession(p);
    this.log.push('info', 'session', '会话已建立'); // B5：触发 log:append
    if (!this._sessionAccepted) { this._sessionAccepted = true; void this.cycle(); }
  }
}

function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }
