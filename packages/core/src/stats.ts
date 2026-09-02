/**
 * 限额本地镜像 + 进度统计（只读，仅用于 UI 展示与预测；不参与服务端判定）
 * v5 按秒体系：
 *  帮听上限 = min(最长歌, 300s) × 30（无歌 = 系统基准 helpSecondsMinSongSec）
 */

export function helpSecondsLimit(maxSongSec: number, coeff = 30, maxBaseSec = 300, noSongBaseSec = 61): number {
  const base = maxSongSec > 0 ? Math.min(maxSongSec, maxBaseSec) : noSongBaseSec;
  return base * coeff;
}

export interface Progress {
  used: number;
  limit: number;
  ratio: number;       // 0..1
  remaining: number;
  state: 'ok' | 'warn' | 'full';
}

export function progress(used: number, limit: number): Progress {
  const safeLimit = limit > 0 ? limit : 0;
  const ratio = safeLimit > 0 ? Math.min(1, used / safeLimit) : 0;
  return {
    used, limit: safeLimit,
    ratio,
    remaining: Math.max(0, safeLimit - used),
    state: ratio >= 1 ? 'full' : ratio >= 0.8 ? 'warn' : 'ok',
  };
}

/** 本地每日窗口重置预估（服务端以 24h 滚动窗口为准，这里仅提示） */
export function nextResetHint(now: Date, tzHour = 0): string {
  const d = new Date(now);
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, tzHour, 0, 0);
  const h = Math.floor((next.getTime() - now.getTime()) / 3600_000);
  return h >= 1 ? `${h} 小时后重置` : '即将重置';
}
