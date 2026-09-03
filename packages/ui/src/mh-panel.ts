/**
 * <mh-panel> 主面板 · v5.1（圆环主指标 + 图标行 + 骨架 + 空态 + 设置弹层 + 诊断复制）
 * 油猴/扩展共用；shadow DOM 隔离；默认收起 44px 红圆球
 */

/* —— 设置存储辅助（B2）：GM → chrome.storage.local → localStorage，统一异步接口 —— */
const SETTING_PREFIX = 'mh_setting_';

/** 读取设置（异步，统一返回 Promise） */
export async function getSetting<T = unknown>(key: string, fallback?: T): Promise<T | undefined> {
  const k = SETTING_PREFIX + key;
  const g = globalThis as unknown as Record<string, any>;
  // 1) 油猴
  if (typeof g.GM_getValue === 'function') {
    try { const v = g.GM_getValue(k); return (v === undefined ? fallback : v) as T; } catch { /* 忽略 */ }
  }
  // 2) 扩展 chrome.storage.local（异步）
  if (typeof g.chrome?.storage?.local?.get === 'function') {
    try { const o = await g.chrome.storage.local.get(k); return (o?.[k] ?? fallback) as T; } catch { /* 忽略 */ }
  }
  // 3) localStorage 兜底（同步，包装成 Promise）
  try {
    const v = globalThis.localStorage.getItem(k);
    return (v === null ? fallback : JSON.parse(v)) as T;
  } catch { /* 忽略 */ }
  return fallback as T;
}

/** 写入设置（异步，统一返回 Promise） */
export async function setSetting(key: string, value: unknown): Promise<void> {
  const k = SETTING_PREFIX + key;
  const g = globalThis as unknown as Record<string, any>;
  // 1) 油猴
  if (typeof g.GM_setValue === 'function') {
    try { g.GM_setValue(k, value); return; } catch { /* 忽略 */ }
  }
  // 2) 扩展 chrome.storage.local（异步）
  if (typeof g.chrome?.storage?.local?.set === 'function') {
    try { await g.chrome.storage.local.set({ [k]: value }); return; } catch { /* 忽略 */ }
  }
  // 3) localStorage 兜底
  try { globalThis.localStorage.setItem(k, JSON.stringify(value)); } catch { /* 忽略 */ }
}

/** 脱敏昵称：仅保留首字符，其余替换为 *** */
function maskName(n: string): string {
  if (!n) return '—';
  if (n.length <= 1) return n + '***';
  return n[0] + '***';
}

/** 从 UA 提取「浏览器 版本 · 系统」概要 */
function browserInfo(ua: string): string {
  const os = /Windows/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad/.test(ua) ? 'iOS'
    : /Linux/.test(ua) ? 'Linux' : '未知';
  let b = '浏览器', v = '';
  const m = /(?:Chrome|Firefox|Edg|Safari)\/([0-9.]+)/.exec(ua);
  if (m) {
    b = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : 'Safari';
    v = m[1];
  }
  return `${v ? `${b} ${v}` : b} · ${os}`;
}

/** 环境探测客户端类型：油猴 GM → userscript；chrome → extension；否则 client */
function detectClientType(): string {
  const g = globalThis as unknown as Record<string, any>;
  if (typeof g.GM_getValue === 'function') return 'userscript';
  if (typeof g.chrome?.storage?.local?.get === 'function') return 'extension';
  return 'client';
}

export class MhPanel extends HTMLElement {
  static define(tag = 'mh-panel') {
    if (!customElements.get(tag)) customElements.define(tag, MhPanel);
  }
  private open = false;
  private state: Record<string, unknown> = {};
  private _toastTimer = 0;

  constructor(tokens = '') {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = TEMPLATE.replace('$TOKENS$', tokens);
    this.bind(root);
    requestAnimationFrame(() => this.toggle(true)); // v4 常驻：默认展开
    this.attachDrag(root);
    this.restorePos(root);
    void this.hydrateSettings(root); // B2：从存储恢复设置 → state + UI
    this.armAutoCollapse();
    // B3：监听自身派发的「复制诊断」事件 → 组装文本写剪贴板
    this.addEventListener('mh:diagnose', () => { void this.copyDiagnostic(this.buildDiagnostic()); });
    // B4：兜底——外部（core 端点）也可派发 mh:log-append 让面板自增 logCount
    this.addEventListener('mh:log-append', (e) => {
      const d = (e as CustomEvent).detail;
      this.pushLog(d?.level ?? 'info', d?.text ?? String(d ?? ''));
    });
  }

  /* —— v4：拖动吸附（右上/右中/右下三档 + localStorage 记忆）—— */
  private attachDrag(root: ShadowRoot) {
    const grip = root.querySelector('[data-grip]') as HTMLElement;
    const panel = root.querySelector('.panel') as HTMLElement;
    if (!grip || !panel) return;
    grip.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const startX = e.clientX, startY = e.clientY;
      const r = panel.getBoundingClientRect();
      const move = (ev: PointerEvent) => {
        panel.style.right = 'auto';
        panel.style.top = 'auto';
        panel.style.left = `${Math.max(8, r.left + ev.clientX - startX)}px`;
        panel.style.top = `${Math.max(8, r.top + ev.clientY - startY)}px`;
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        const rect = panel.getBoundingClientRect();
        const vh = window.innerHeight;
        const snappedTop = rect.top < vh * 0.38 ? 66 : rect.bottom > vh * 0.62 ? vh - rect.height - 12 : vh * 0.42;
        const right = Math.max(8, window.innerWidth - rect.right);
        panel.style.left = 'auto'; panel.style.top = 'auto';
        panel.style.right = `${right}px`; panel.style.top = `${Math.round(snappedTop)}px`;
        localStorage.setItem('mh-panel-pos', JSON.stringify({ right, top: Math.round(snappedTop) }));
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }
  private restorePos(root: ShadowRoot) {
    try {
      const p = JSON.parse(localStorage.getItem('mh-panel-pos') || 'null');
      if (p && typeof p.right === 'number') {
        const panel = root.querySelector('.panel') as HTMLElement;
        const ball = root.querySelector('.ball') as HTMLElement;
        for (const el of [panel, ball]) {
          el.style.top = `${p.top}px`; el.style.right = `${p.right}px`;
        }
      }
    } catch { /* 忽略损坏记忆 */ }
  }
  /* —— v4：5 分钟无操作自动收起（state.autoCollapse === false 时关闭）—— */
  private armAutoCollapse() {
    const t = () => {
      // B2：autoCollapse 来自持久设置（hydrate 后进入 state.autoCollapse）
      if (this.state.autoCollapse !== false) this.toggle(false);
      this.poke();
    };
    this.poke();
    setInterval(t, 300000);
  }
  private lastPoke = 0;
  private poke() { this.lastPoke = Date.now(); }

  /* —— B2：从存储恢复设置到 state，并同步设置 UI —— */
  private async hydrateSettings(root: ShadowRoot): Promise<void> {
    const [songIds, autoStart, onlyHelp, autoCollapse, logReport] = await Promise.all([
      getSetting<string>('songIds', ''),
      getSetting<boolean>('autoStart', true),
      getSetting<boolean>('onlyHelp', false),
      getSetting<boolean>('autoCollapse', false), // 默认「始终展开」ON = 不自动收起 → autoCollapse=false
      getSetting<boolean>('logReport', true),
    ]);
    this.state.songIds = songIds ?? '';
    this.state.autoStart = autoStart ?? true;
    this.state.onlyHelp = onlyHelp ?? false;
    this.state.autoCollapse = autoCollapse ?? false;
    this.state.logReport = logReport ?? true;
    this.syncSettingsUI(root);
  }

  /** 把 state 中的设置写到设置 UI（打开弹层时调用） */
  private syncSettingsUI(root: ShadowRoot): void {
    const q = (s: string) => root.querySelector(s) as HTMLElement | null;
    const ta = q('[data-songids]') as HTMLTextAreaElement | null;
    if (ta) ta.value = String(this.state.songIds ?? '');
    const map: Array<[string, string]> = [
      ['[data-onlyhelp]', 'onlyHelp'],
      ['[data-autostart]', 'autoStart'],
      ['[data-autocollapse]', 'autoCollapse'],
      ['[data-logreport]', 'logReport'],
    ];
    for (const [sel, key] of map) {
      const sw = q(sel);
      if (!sw) continue;
      // autoCollapse 语义反转为「始终展开」：开关 ON ↔ autoCollapse=false
      const on = key === 'autoCollapse' ? !Boolean(this.state[key]) : Boolean(this.state[key]);
      sw.classList.toggle('on', on);
    }
  }

  /** 切换设置弹层显示/隐藏 */
  private toggleSettings(root: ShadowRoot, show?: boolean): void {
    const s = root.querySelector('[data-settings]');
    if (!s) return;
    const next = show !== undefined ? show : s.classList.contains('hidden');
    s.classList.toggle('hidden', !next);
    if (next) this.syncSettingsUI(root);
  }

  /** B2：保存设置 → 持久存储 + 更新 state + toast + 关闭 */
  private async saveSettings(root: ShadowRoot): Promise<void> {
    const q = (s: string) => root.querySelector(s) as HTMLElement | null;
    const ta = q('[data-songids]') as HTMLTextAreaElement | null;
    const songIds = ta?.value ?? '';
    const read = (sel: string): boolean => !!(q(sel)?.classList.contains('on'));
    const s = {
      songIds,
      autoStart: read('[data-autostart]'),
      onlyHelp: read('[data-onlyhelp]'),
      autoCollapse: !read('[data-autocollapse]'), // 开关 ON（始终展开）→ autoCollapse=false
      logReport: read('[data-logreport]'),
    };
    await Promise.all([
      setSetting('songIds', s.songIds),
      setSetting('autoStart', s.autoStart),
      setSetting('onlyHelp', s.onlyHelp),
      setSetting('autoCollapse', s.autoCollapse),
      setSetting('logReport', s.logReport),
    ]);
    this.state.songIds = s.songIds;
    this.state.autoStart = s.autoStart;
    this.state.onlyHelp = s.onlyHelp;
    this.state.autoCollapse = s.autoCollapse;
    this.state.logReport = s.logReport;
    this.render();
    q('[data-settings]')?.classList.add('hidden');
    this.toast(root, '已保存');
  }

  /** 轻量 toast（面板内短暂提示） */
  private toast(root: ShadowRoot, text: string): void {
    const el = root.querySelector('[data-toast]') as HTMLElement | null;
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = window.setTimeout(() => el.classList.remove('show'), 1500);
  }

  /* —— B4：外部调用的日志追加入口（自增 logCount + 更新 [data-log]）—— */
  pushLog(_level: string, _text: string): void {
    this.setState({ logCount: Math.min(999, Number(this.state.logCount ?? 0) + 1) });
  }

  /* —— B3：面板自身 state 组装脱敏诊断文本 —— */
  buildDiagnostic(): string {
    const st = this.state as Record<string, any>;
    const version = st.version ?? '5.1';
    const clientType = st.clientType ?? detectClientType();
    const server = st.server ?? '163music.linyu.qzz.io';
    let displayName = st.displayName as string | undefined;
    if (!displayName && typeof st.title === 'string') {
      const m = /已登录\s*·\s*(.*)$/.exec(st.title as string);
      if (m) displayName = m[1];
    }
    const account = displayName ? `已登录 · 昵称${maskName(String(displayName))}` : '未登录';
    const online = typeof st.dotOff === 'boolean' ? !st.dotOff : true;
    const hb = st.hbText ? String(st.hbText) : '—';
    const help = st.help ?? 0;
    const limit = st.limit ?? 0;
    const settings = `autoStart=${st.autoStart ? 1 : 0} onlyHelp=${st.onlyHelp ? 1 : 0} autoCollapse=${st.autoCollapse ? 1 : 0} logReport=${st.logReport ? 1 : 0}`;
    return [
      '🎧 网易云音乐互助客户端诊断',
      '──────────────────────',
      `版本    : ${version} (${clientType})`,
      `浏览器  : ${browserInfo(typeof navigator !== 'undefined' ? navigator.userAgent : '')}`,
      `账号    : ${account}`,
      `服务器  : ${server}`,
      `状态    : ${online ? '在线' : '未在线'}`,
      `心跳    : ${hb}`,
      `今日    : ${help}/${limit} 秒`,
      `设置    : ${settings}`,
      '（token / 登录态已脱敏）',
    ].join('\n');
  }

  /* —— B3：剪贴板写入优先级 GM.setClipboard → navigator.clipboard → prompt 兜底 —— */
  private async copyDiagnostic(text: string): Promise<boolean> {
    const g = globalThis as unknown as Record<string, any>;
    if (typeof g.GM_setClipboard === 'function') {
      try { g.GM_setClipboard(text); return true; } catch { /* 忽略 */ }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try { await navigator.clipboard.writeText(text); return true; } catch { /* 忽略 */ }
    }
    try { window.prompt('复制以下内容', text); return true; } catch { /* 忽略 */ }
    return false;
  }

  private bind(root: ShadowRoot) {
    const q = (s: string) => root.querySelector(s) as HTMLElement;
    q('.ball')?.addEventListener('click', () => this.toggle(true));
    q('[data-min]')?.addEventListener('click', () => this.toggle(false));
    q('[data-log]')?.addEventListener('click', () => this.dispatchEvent(new CustomEvent('mh:log-open')));
    q('[data-diag]')?.addEventListener('click', () => this.dispatchEvent(new CustomEvent('mh:diagnose')));
    q('[data-exit]')?.addEventListener('click', () => this.dispatchEvent(new CustomEvent('mh:logout')));
    q('[data-abandon]')?.addEventListener('click', () => this.dispatchEvent(new CustomEvent('mh:abandon')));
    // B1：设置入口 / 关闭 / 空态去设置
    q('[data-settoggle]')?.addEventListener('click', () => this.toggleSettings(root));
    q('[data-close-settings]')?.addEventListener('click', () => this.toggleSettings(root, false));
    q('[data-goset]')?.addEventListener('click', () => this.toggleSettings(root, true));
    q('[data-save]')?.addEventListener('click', () => { void this.saveSettings(root); });
    // B1：设置开关行（.sw 点击切换 on）
    root.querySelectorAll('[data-settings] .sw').forEach((sw) => {
      sw.addEventListener('click', () => sw.classList.toggle('on'));
    });
  }

  toggle(open?: boolean) {
    this.open = open ?? !this.open;
    const panel = this.shadowRoot!.querySelector('.panel') as HTMLElement;
    const ball = this.shadowRoot!.querySelector('.ball') as HTMLElement;
    panel.classList.toggle('open', this.open);
    ball.style.display = this.open ? 'none' : 'flex';
  }

  setState(s: Record<string, unknown>) {
    this.state = { ...this.state, ...s };
    this.render();
  }

  private render() {
    const root = this.shadowRoot!;
    const q = (s: string) => root.querySelector(s) as HTMLElement;
    const st = this.state;
    if (st.title !== undefined) q('[data-title]').textContent = String(st.title);
    if (st.subtitle !== undefined) q('[data-subtitle]').textContent = String(st.subtitle);
    if (st.dotOff !== undefined) q('.dot') && (root.querySelector('[data-title]') as HTMLElement);
    const ratio = typeof st.ratio === 'number' ? st.ratio : 0;
    const C = 2 * Math.PI * 36;
    const ring = root.querySelector('circle[data-ring]') as SVGCircleElement | null;
    if (ring) { ring.setAttribute('stroke-dasharray', String(C)); ring.setAttribute('stroke-dashoffset', String(C * (1 - ratio))); }
    (q('[data-ringpct]') as HTMLElement).textContent = `${Math.round(ratio * 100)}%`;
    if (st.help !== undefined) q('[data-help]').textContent = String(st.help);
    if (st.limit !== undefined) q('[data-limit]').textContent = String(st.limit);
    if (st.remaining !== undefined) q('[data-rem]').textContent = `剩余 ${st.remaining} 秒`;
    if (st.earned !== undefined) q('[data-earned]').textContent = String(st.earned);
    const taskBox = q('[data-taskbox]') as HTMLElement;
    if (st.task) {
      taskBox.style.display = '';
      q('[data-song]').textContent = `《${st.task.name ?? '—'}》`;
      q('[data-songtime]').textContent = String(st.task.timeText ?? '0:00 / 0:00');
      if (typeof st.task.playRatio === 'number') (q('[data-taskbar]') as HTMLElement).style.width = `${Math.round(st.task.playRatio * 100)}%`;
      if (st.hbText !== undefined) (q('[data-hb]') as HTMLElement).innerHTML = `<b>● ${st.hbText}</b> 心跳`;
    } else {
      taskBox.style.display = 'none';
    }
    if (st.recv !== undefined || st.rec !== undefined) {
      // 兼容端点键名差异：extension 用 recv/recLimit，userscript 用 rec/recRatio/recLimit
      const recvVal = Number(st.recv ?? st.rec ?? 0);
      const recvLim = Number(st.recvLimit ?? st.recLimit ?? 26);
      q('[data-recv]').textContent = `${recvVal} / ${recvLim} 次`;
      const pct = st.recvPct !== undefined ? Number(st.recvPct)
        : st.recRatio !== undefined ? Number(st.recRatio)
        : (recvLim > 0 ? Math.round((recvVal / recvLim) * 100) : 0);
      (q('[data-recvbar]') as HTMLElement).style.width = `${Math.min(100, pct)}%`;
      q('[data-recvpct]').textContent = `${pct}%`;
    }
    const body = q('[data-body]') as HTMLElement;
    if (st.loading) body.classList.add('hidden');
    if (st.loading !== undefined) q('[data-skeleton]').classList.toggle('hidden', !st.loading);
    if (st.empty) { q('[data-empty]').classList.remove('hidden'); body.classList.add('hidden'); }
    else q('[data-empty]').classList.add('hidden');
    if (st.logCount !== undefined) q('[data-log]').textContent = `日志 (${Number(st.logCount)})`;
    if (st.dotOff !== undefined) (root.querySelector('.dot') as HTMLElement | null)?.classList.toggle('off', Boolean(st.dotOff));
  }
}

const TEMPLATE = `
<style>
$TOKENS$
  :host{--mh-r:16px;--mh-sh:0 2px 6px rgba(35,38,46,.05),0 12px 32px rgba(35,38,46,.08)}
  .panel{position:fixed;right:18px;top:66px;z-index:2147483000;width:330px;background:var(--mh-card);
    border-radius:var(--mh-r);box-shadow:var(--mh-sh);overflow:hidden;font-family:var(--mh-font);
    color:var(--mh-t1);font-size:13px;transform:translateX(370px);opacity:0;transition:all .22s ease}
  .panel.open{transform:none;opacity:1}
  .ball{position:fixed;right:18px;top:66px;z-index:2147483000;width:44px;height:44px;border-radius:50%;
    background:var(--mh-red);color:#fff;display:flex;align-items:center;justify-content:center;
    box-shadow:0 4px 12px rgba(236,65,65,.35);cursor:pointer;font-size:19px}
  .ic{width:26px;height:26px;border-radius:8px;background:var(--mh-red);display:flex;align-items:center;
    justify-content:center;color:#fff;font-size:14px;flex:none}
  .ic.soft{background:#FDF0F0;color:var(--mh-red);font-size:13px}
  .top{display:flex;align-items:center;gap:10px;padding:15px 17px 0}
  .name{font-weight:700;font-size:13.5px}
  .sub{font-size:11px;color:var(--mh-t2)}
  .sp{flex:1}
  .mini{cursor:pointer;color:var(--mh-t2);font-size:13px}
  .main{display:flex;align-items:center;gap:14px;padding:15px 17px}
  .ring{flex:none}
  .mnum{font-size:26px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.5px;line-height:1.1}
  .mnum .u{font-size:12px;color:var(--mh-t2);font-weight:500}
  .ml{font-size:11.5px;color:var(--mh-t2);margin-top:3px}
  .chip{font-size:11px;color:var(--mh-t2);margin-top:7px}
  .dv{height:1px;background:var(--mh-line);margin:0 17px}
  .row{display:flex;align-items:center;gap:10px;padding:11px 17px}
  .grow{flex:1}
  .sn{font-weight:600;font-size:13px}
  .tm{font-size:12px;color:var(--mh-t2);font-variant-numeric:tabular-nums}
  .bar{height:5px;border-radius:3px;background:var(--mh-track);overflow:hidden;margin:0 17px}
  .bar i{display:block;height:100%;background:var(--mh-red);border-radius:3px;transition:width .4s ease}
  .hbc{font-size:11px;color:var(--mh-t2)} .hbc b{color:var(--mh-ok);font-weight:600}
  .danger{font-size:11.5px;color:var(--mh-danger);cursor:pointer}
  .foot{display:flex;border-top:1px solid var(--mh-line);font-size:12px;color:var(--mh-t2)}
  .foot span{flex:1;text-align:center;padding:11px 0;cursor:pointer}
  .foot span:hover{color:var(--mh-red);background:#FFFBFB}
  .hidden{display:none!important}
  .sk{height:12px;border-radius:6px;background:linear-gradient(90deg,#F1F2F6 25%,#E8EAF0 50%,#F1F2F6 75%);background-size:200% 100%;animation:ld 1.2s infinite}
  @keyframes ld{0%{background-position:200% 0}100%{background-position:-200% 0}}
  .empty{padding:26px 20px;text-align:center}
  .empty .ic{font-size:34px;background:none;color:var(--mh-t2)}
  .empty .t{font-weight:700;margin:10px 0 6px}
  .empty .d{font-size:12px;color:var(--mh-t2);margin-bottom:14px}
  .go{display:inline-block;padding:9px 26px;border-radius:8px;background:var(--mh-red);color:#fff;font-weight:600;cursor:pointer;font-size:12.5px}
  /* —— B1：设置弹层 —— */
  .settings{background:#FBFBFC;border-top:1px solid var(--mh-line);padding:2px 17px 14px;font-size:12px}
  .set-head{display:flex;align-items:center;gap:8px;padding:10px 0 4px;font-weight:700;color:var(--mh-t1);font-size:12.5px}
  .set-x{cursor:pointer;color:var(--mh-t2)}
  .set-title{font-size:11px;color:var(--mh-t2);margin:7px 0 3px}
  .set-songids{width:100%;box-sizing:border-box;border:1px solid var(--mh-line);border-radius:8px;background:var(--mh-card);color:var(--mh-t1);padding:7px 9px;font-family:inherit;font-size:12px;resize:vertical}
  .set-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:9px}
  .set-row small{color:var(--mh-t2)}
  .sw{width:36px;height:20px;border-radius:10px;background:#E3E4E8;position:relative;cursor:pointer;flex:none;transition:background .18s}
  .sw i{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:left .18s}
  .sw.on{background:var(--mh-red)}
  .sw.on i{left:18px}
  .set-foot{display:flex;align-items:center;gap:10px;margin-top:13px}
  .btn-set{flex:1;text-align:center;padding:8px 0;border-radius:8px;background:#F1F2F6;color:var(--mh-danger);cursor:pointer;font-size:12.5px}
  .btn-save{flex:1;padding:8px 0;border-radius:8px;background:var(--mh-red);color:#fff;font-weight:600;cursor:pointer;font-size:12.5px;border:none}
  .toast{position:absolute;top:12px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.72);color:#fff;font-size:12px;padding:5px 14px;border-radius:14px;z-index:2;pointer-events:none;opacity:0;transition:opacity .2s}
  .toast.show{opacity:1}
</style>
<div class="ball" part="ball">♪</div>
<div class="panel" part="panel">
  <div class="toast" data-toast></div>
  <div class="top">
    <span class="ic">♪</span>
    <div><div class="name" data-title>已登录 · 互助中</div><div class="sub" data-subtitle>在线 · 静静挂机中</div></div>
    <div class="sp"></div>
    <span class="mini" data-min>−</span>
  </div>
  <div data-body>
    <div class="main">
      <svg class="ring" width="86" height="86" viewBox="0 0 86 86">
        <circle cx="43" cy="43" r="36" fill="none" stroke="var(--mh-track)" stroke-width="8"/>
        <circle data-ring cx="43" cy="43" r="36" fill="none" stroke="var(--mh-red)" stroke-width="8"
          stroke-linecap="round" transform="rotate(-90 43 43)"/>
        <text data-ringpct x="43" y="47" text-anchor="middle" font-size="15" font-weight="800"
          fill="currentColor" font-family="system-ui">0%</text>
      </svg>
      <div>
        <div class="mnum"><span data-help>0</span><span class="u"> / <span data-limit>9000</span> 秒</span></div>
        <div class="ml">今日帮听额度 · <span data-earned>0</span> 分钟收益</div>
        <div class="chip" data-rem>剩余 9000 秒</div>
      </div>
    </div>
    <div class="dv"></div>
    <div data-taskbox style="display:none">
      <div class="row">
        <span class="ic soft">▶</span>
        <div class="grow"><div class="sn" data-song>—</div><div class="tm" data-songtime>0:00 / 0:00</div></div>
        <div class="hbc" data-hb><b>● —</b> 心跳</div><span class="danger" data-abandon>放弃</span>
      </div>
      <div class="bar"><i data-taskbar style="width:0"></i></div>
    </div>
    <div class="dv" style="margin-top:13px"></div>
    <div class="row">
      <span class="ic soft">🛡</span>
      <div class="grow"><div class="sn">我被帮助</div><div class="tm"><span data-recv>0 / 26 次</span> · 今晚 21:00 满额</div></div>
      <div class="chip" style="font-size:12px"><b data-recvpct>0%</b></div>
    </div>
    <div class="bar"><i data-recvbar style="width:0"></i></div>
  </div>
  <div class="settings hidden" data-settings>
    <div class="set-head">面板设置<span class="sp"></span><span class="set-x" data-close-settings>✕</span></div>
    <div class="set-body">
      <div class="set-title">🎵 歌曲 ID（多个回车分隔）</div>
      <textarea class="set-songids" data-songids rows="3" placeholder="1885811597&#10;1599963012"></textarea>
      <div class="set-row"><span>只帮不助<small> 只挂歌不请求帮助</small></span><span class="sw" data-onlyhelp role="switch"><i></i></span></div>
      <div class="set-row"><span>自动开启<small> 页面加载即自动开始</small></span><span class="sw on" data-autostart role="switch"><i></i></span></div>
      <div class="set-row"><span>始终展开<small> 开启=不自动收起；关闭=5分钟无操作自动收起</small></span><span class="sw on" data-autocollapse role="switch"><i></i></span></div>
      <div class="set-row"><span>错误自动上报<small> 匿名脱敏后发服务端</small></span><span class="sw on" data-logreport role="switch"><i></i></span></div>
    </div>
    <div class="set-foot">
      <span class="btn-set" data-exit>退出登录</span>
      <button class="btn-save" data-save>保存</button>
    </div>
  </div>
  <div class="skeleton hidden" data-skeleton>
    <div class="main"><div class="sk" style="width:86px;height:86px;border-radius:50%"></div>
      <div style="flex:1"><div class="sk" style="width:70%"></div><div class="sk" style="width:45%;margin-top:8px"></div></div></div>
    <div class="dv"></div>
    <div class="main"><div class="sk" style="width:88%"></div></div>
  </div>
  <div class="empty hidden" data-empty>
    <div class="ic">🎧</div>
    <div class="t">还没有歌在听</div>
    <div class="d">去「设置」粘贴歌曲 ID 或登录，立即开始互助</div>
    <span class="go" data-goset>去设置</span>
  </div>
  <div class="foot">
    <span data-log>日志 (0)</span><span data-settoggle>设置</span><span data-diag>复制诊断</span>
  </div>
</div>
`;
