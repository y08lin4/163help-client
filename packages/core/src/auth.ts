/**
 * auth：登录态管理（token 存储抽象 / 刷新策略 / 状态机）
 * 关键规则：401 且 refresh 失败 → 清态 + logged_out（引导重登）；网络/5xx 不清态退避重试。
 */
import { EventBus } from './events.js';
import { helpSecondsLimit } from './stats.js';
import type { ApiResult, AuthStatus, LimitsPayload, LoginPayload, MePayload, PlatformAdapter } from './types.js';

const REFRESH_SKEW_MS = 5000;
const RETRY_DELAY_MS = [1000, 3000, 8000]; // 有限退避

export interface AuthApi {
  login(): Promise<LoginPayload | null>;                      // 登录由平台页面完成（oauth 回跳携带票据）
  refresh(token: string): Promise<LoginPayload | null>;       // POST /auth/refresh
  me(): Promise<ApiResult<MePayload>>;
}

export class AuthManager {
  status: AuthStatus = 'no_token';

  constructor(
    private adapter: PlatformAdapter,
    private api: AuthApi,
    private bus: EventBus,
  ) {}

  /** 已登录（有可用 token）？ */
  hasToken(): boolean { return this.adapter.storage.getToken() !== ''; }

  private setStatus(s: AuthStatus): void {
    if (this.status !== s) { this.status = s; this.bus.emit('auth:status', s); }
  }

  /** 存登录结果（oauth 回跳后由登录页调用） */
  acceptSession(p: LoginPayload): void {
    this.adapter.storage.setToken(p.token);
    this.adapter.storage.setExpires('access', Date.parse(p.access_expires_at));
    this.adapter.storage.setExpires('refresh', Date.parse(p.refresh_expires_at));
    this.setStatus('valid');
    void this.refreshUser();
  }

  clearSession(): void {
    this.adapter.storage.clearToken();
    this.setStatus('logged_out');
    this.bus.emit('auth:user', null);
  }

  private tokenNeedsRefresh(): boolean {
    const at = this.adapter.storage.getExpires('access');
    return at > 0 && Date.now() >= at - REFRESH_SKEW_MS;
  }

  /** 确保新鲜：需要时先 refresh；返回真实 token（空=未登录） */
  async ensureToken(): Promise<string> {
    const token = this.adapter.storage.getToken();
    if (!token) { this.setStatus('no_token'); return ''; }
    if (this.tokenNeedsRefresh() || this.status === 'refreshing') {
      await this.refreshToken();
    }
    return this.adapter.storage.getToken();
  }

  private refreshPromise: Promise<boolean> | null = null;

  /** 刷新（并发去重；401→清态；网络/5xx→有限退避后仍失败则不清态保留旧凭证） */
  async refreshToken(): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      this.setStatus('refreshing');
      const token = this.adapter.storage.getToken();
      if (!token) { this.setStatus('no_token'); return false; }
      let ok = false;
      for (const delay of [...RETRY_DELAY_MS, null]) {
        const p = await this.api.refresh(token);
        if (p) { this.acceptSession(p); ok = true; break; }
        if (delay !== null) await sleep(delay);
        // 最后一次失败：若已 401 语义（api 层区分）→ 清态
      }
      if (!ok) {
        // 网络类失败保留旧凭证（下次重试）；仅当明确 token 失效才清态（由 api 层通过 error 码告知）
        if (this.status === 'refreshing') this.setStatus('valid');
      }
      this.refreshPromise = null;
      return ok;
    })();
    return this.refreshPromise;
  }

  async refreshUser(): Promise<void> {
    const token = await this.ensureToken();
    if (!token) return;
    const r = await this.api.me();
    if (r.status === 200 && r.payload) {
      this.bus.emit('auth:user', { displayName: r.payload.displayName, credits: r.payload.credits });
      this.emitLimitsFrom(r.payload);
    } else if (r.status === 401) {
      const refreshed = await this.refreshToken();
      if (!refreshed) this.clearSession();
    }
  }

  /** B5：me() 成功回调后发射 limits:updated（仅在数值变化时）。me() 无限额字段则用 stats.ts 推算兜底 */
  private lastLimitsKey = '';
  private emitLimitsFrom(p: MePayload): void {
    const hasReal = [p.helpedToday, p.helpedLimit, p.receivedToday, p.receivedLimit].some((v) => typeof v === 'number');
    // 兜底：无真实限额时按「代表性 300s 歌」推算 = 9000s（与面板/快照/docker 默认一致）
    const fallbackLimit = helpSecondsLimit(300);
    const limits: LimitsPayload = hasReal
      ? {
        helpedToday: p.helpedToday ?? 0,
        helpedLimit: p.helpedLimit ?? fallbackLimit,
        receivedToday: p.receivedToday ?? 0,
        receivedLimit: p.receivedLimit ?? 26,
      }
      : {
        helpedToday: 0,
        helpedLimit: fallbackLimit,
        receivedToday: 0,
        receivedLimit: 26,
      };
    const key = JSON.stringify(limits);
    if (key === this.lastLimitsKey) return;
    this.lastLimitsKey = key;
    this.bus.emit('limits:updated', limits);
  }

  /** 供 401 处理：refresh 重试；失败清态 */
  async onUnauthorized(): Promise<boolean> {
    const ok = await this.refreshToken();
    if (!ok) this.clearSession();
    return ok;
  }
}

function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }
