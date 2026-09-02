/**
 * <mh-panel> 主面板 · design-v3（圆环主指标 + 图标行 + 骨架 + 空态）
 * 油猴/扩展共用；shadow DOM 隔离；默认收起 44px 红圆球
 */
export class MhPanel extends HTMLElement {
  static define(tag = 'mh-panel') {
    if (!customElements.get(tag)) customElements.define(tag, MhPanel);
  }
  private open = false;
  private state: Record<string, unknown> = {};

  constructor(tokens = '') {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = TEMPLATE.replace('$TOKENS$', tokens);
    this.bind(root);\n    requestAnimationFrame(() => this.toggle(true)); // v4 常驻：默认展开\n  }

  private bind(root: ShadowRoot) {
    const q = (s: string) => root.querySelector(s) as HTMLElement;
    q('.ball')?.addEventListener('click', () => this.toggle(true));
    q('[data-min]')?.addEventListener('click', () => this.toggle(false));
    q('[data-log]')?.addEventListener('click', () => this.dispatchEvent(new CustomEvent('mh:log-open')));
    q('[data-diag]')?.addEventListener('click', () => this.dispatchEvent(new CustomEvent('mh:diagnose')));
    q('[data-exit]')?.addEventListener('click', () => this.dispatchEvent(new CustomEvent('mh:logout')));
    q('[data-abandon]')?.addEventListener('click', () => this.dispatchEvent(new CustomEvent('mh:abandon')));
    q('[data-goset]')?.addEventListener('click', () => this.dispatchEvent(new CustomEvent('mh:open-settings')));
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
    if (st.recv !== undefined) q('[data-recv]').textContent = `${st.recv} / ${st.recvLimit ?? 26} 次`;
    if (st.recvPct !== undefined) {
      (q('[data-recvbar]') as HTMLElement).style.width = `${Math.min(100, Number(st.recvPct))}%`;
      q('[data-recvpct]').textContent = `${st.recvPct}%`;
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
</style>
<div class="ball" part="ball">♪</div>
<div class="panel" part="panel">
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
    <span data-log>日志 (0)</span><span data-diag>复制诊断</span><span data-exit>退出</span>
  </div>
</div>
`;
