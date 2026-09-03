/**
 * 与 server 对齐的全部契约类型（v5 按秒体系）
 */

export type ClientType = 'userscript' | 'extension' | 'docker';
export type JobStatus = 'issued' | 'finished' | 'rejected' | 'expired';
export type LogLevel = 'info' | 'warn' | 'error';
export type AuthStatus = 'no_token' | 'refreshing' | 'valid' | 'logged_out';
export type JobPhase = 'idle' | 'fetching' | 'playing' | 'abandoning' | 'settle_failed';

/** 平台差异抽象：存储/网络/页面能力 */
export interface PlatformAdapter {
  readonly clientType: ClientType;
  readonly version: string;
  storage: TokenStore;
  /** 网络连通性探测（页面 fetch HEAD / docker ping 脚本） */
  probeNetwork(): Promise<boolean>;
  /** 是否有真实页面可注入 UI（docker=false） */
  readonly hasPage: boolean;
  /** 页面冻结/恢复钩子（pagehide/freeze/resume）；docker 为空实现 */
  onLifecycle?(hook: 'freeze' | 'resume', cb: () => void): void;
}

export interface TokenStore {
  getToken(): string;
  setToken(token: string): void;
  clearToken(): void;
  getExpires(key: 'access' | 'refresh'): number; // 0=未知
  setExpires(key: 'access' | 'refresh', atMs: number): void;
}

/** 服务器会话载荷 */
export interface LoginPayload {
  token: string;
  access_expires_at: string;
  refresh_expires_at: string;
}

/** /api/next 响应 */
export interface NextPayload {
  musicId: string | null;
  sourceMusicId?: string | null;
  jobId?: string;
  creditCost?: number;
  targetDurationMs?: number;
  requiredListenMs?: number;
  requiredListenRatio?: number;
  owner?: { displayName?: string };
  participant?: Participant;
  noTargetReason?: string | null;
}

export interface Participant {
  user?: { displayName?: string };
  availableCredits?: number;
  todayHelpedSeconds?: number;
  effectiveHelpSecondsLimit?: number;
  todayHelpedSecondsRemaining?: number;
  receivedToday?: number;
  receivedLimit?: number;
}

/** finish 上报体 */
export interface FinishInput {
  jobId: string;
  playedMs: number;
  positionMs: number;
  durationMs: number;
  playbackRate: number;
  jumpCount: number;
  backwardJumpCount: number;
  listenDriftMs: number;
  recoveryAttempts: number;
  stallDetected: boolean;
}

/** 心跳上报体 */
export interface HeartbeatInput {
  jobId: string;
  playedMs: number;
  positionMs: number;
  durationMs: number;
  monotonic: boolean;
}

/** 日志上报体（已脱敏） */
export interface ClientLogPayload {
  level: LogLevel;
  event: string;
  msg: string;
  context?: Record<string, string | number | boolean | null>;
  clientVersion: string;
  clientType: ClientType;
}

export interface ApiResult<T = unknown> {
  status: number;
  payload: T | null;
  error?: string;
}

/** 面板限额载荷（limits:updated） */
export interface LimitsPayload {
  helpedToday: number;
  helpedLimit: number;
  receivedToday: number;
  receivedLimit: number;
}

/** /api/me 返回（限额字段可选，缺失时由 core 用 stats 推算兜底） */
export interface MePayload {
  displayName: string;
  credits: number;
  helpedToday?: number;
  helpedLimit?: number;
  receivedToday?: number;
  receivedLimit?: number;
}

/** core 对外事件（→ UI 单向） */
export interface CoreEventMap {
  'auth:status': AuthStatus;
  'auth:user': { displayName: string; credits: number } | null;
  'job:phase': JobPhase;
  'job:current': { jobId: string; musicName: string; targetMs: number; playedMs: number } | null;
  'job:progress': { jobId: string; playedMs: number; positionMs: number };
  'heartbeat:tick': { jobId: string; intervalMs: number; lastAtMs: number };
  'limits:updated': LimitsPayload;
  'log:append': { level: LogLevel; ts: number; msg: string; text?: string; event?: string };
  'upgrade:required': { min: string; latest: string };
}
