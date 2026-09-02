/**
 * <mh-panel> 主面板（shadow DOM，隔离网易云样式）
 * 默认收起为 44px 红色圆球；点开为 320px 白卡
 * 用法：<mh-panel></mh-panel>；通过事件总线驱动（赋值 attributes 或调用 setState）
 */
const TEMPLATE = `
  <style>
    $TOKENS$
    .panel {
      position: fixed; right: 16px; bottom: 96px; z-index: 2147483000;
      width: 320px; border-radius: var(--mh-radius); overflow: hidden;
      background: var(--mh-card); box-shadow: var(--mh-shadow);
      font-family: var(--mh-font); color: var(--mh-t1); font-size: 13px;
      transform: translateX(360px); opacity: 0; transition: all .2s ease;
    }
    .panel.open { transform: none; opacity: 1; }
    .head { display:flex; align-items:center; gap:8px; padding:12px 14px; border-bottom:1px solid var(--mh-line); }
    .dot { width:8px; height:8px; border-radius:50%; background:var(--mh-ok); box-shadow:0 0 0 3px rgba(46,164,79,.15); }
    .dot.off { background:var(--mh-t2); box-shadow:none; }
    .title { font-weight:600; }
    .spacer { flex:1; }
    .icon-btn { cursor:pointer; color:var(--mh-t2); font-size:14px; padding:0 2px; user-select:none; }
    .body { padding:14px; }
    .sec { color:var(--mh-t2); font-size:12px; margin-bottom:8px; }
    .big { font-size:22px; font-weight:700; }
    .unit { font-size:12px; color:var(--mh-t2); font-weight:400; }
    .bar { height:4px; border-radius:2px; background:var(--mh-track); overflow:hidden; margin:8px 0 4px; }
    .bar i { display:block; height:100%; border-radius:2px; background:var(--mh-red); transition:width .3s ease }
    .task { margin-top:16px; border-top:1px solid var(--mh-line); padding-top:12px; }
    .song { display:flex; justify-content:space-between; align-items:center; }
    .song-name { font-weight:600; }
    .time { color:var(--mh-t2); font-variant-numeric:tabular-nums; }
    .text-btn { color:var(--mh-red); cursor:pointer; font-size:12px; }
    .foot { border-top:1px solid var(--mh-line); display:flex; justify-content:space-between; padding:10px 14px; color:var(--mh-t2); font-size:12px; }
    .foot span { cursor:pointer; }
    .ball {
      position: fixed; right: 16px; bottom: 96px; z-index: 2147483000;
      width: 44px; height: 44px; border-radius: 50%;
      background: var(--mh-red); color:#fff; display:flex; align-items:center; justify-content:center;
      box-shadow: 0 4px 12px rgba(236,65,65,.35); cursor:pointer; font-size:20px;
    }
  </style>
  <div class="ball" part="ball">♪</div>
  <div class="panel" part="panel">
    <div class="head">
      <span class="dot"></span><span class="title" data-title>已登录 · 在线</span>
      <span class="spacer"></span><span class="icon-btn" data-min title="收起">－</span>
    </div>
    <div class="body">
      <div class="sec">今日帮听</div>
      <div><span class="big mh-num" data-help>0</span><span class="unit"> / <span data-limit>9000</span> 秒</span></div>
      <div class="bar"><i data-bar style="width:0"></i></div>
      <div class="sec" data-task style="display:none; margin-top:14px">正在帮</div>
      <div data-taskbox style="display:none">
        <div class="song"><span class="song-name" data-song>—</span><span class="time" data-time>0:00 / 0:00</span></div>
        <div class="bar"><i data-taskbar style="width:0"></i></div>
        <div style="display:flex;justify-content:space-between;margin-top:6px">
          <span class="mh-muted" data-hb>♥ 心跳 <span style="color:var(--mh-ok)">● 正常</span></span>
          <span class="text-btn" data-abandon>放弃本任务</span>
        </div>
      </div>
      <div class="sec" style="margin-top:14px">被助进度</div>
      <div><span class="big mh-num" data-recv>0</span><span class="unit"> / <span data-recLimit>26</span> 次</span></div>
      <div class="bar"><i data-recbar style="width:0"></i></div>
    </div>
    <div class="foot"><span data-log>日志 (0)</span><span data-exit>退出</span></div>
  </div>
`;

export class MhPanel extends HTMLElement {
  static define(tag = 'mh-panel') {
    if (!customElements.get(tag)) customElements.define(tag, MhPanel);
  }
  private root: ShadowRoot;
  private open = false;
  private state: Record<string, unknown> = {};
  private tokens: string;

  constructor(tokens = '') {
    super();
    this.tokens = tokens;
    this.root = this.attachShadow({ mode: 'open' });
    this.root.innerHTML = TEMPLATE.replace('$TOKENS$', tokens);
    this.bind();
  }

  private bind() {
    const q = (s: string) => this.root.querySelector(s) as HTMLElement;
    q('.ball').addEventListener('click', () => this.toggle(true));
    q('[data-min]').addEventListener('click', () => this.toggle(false));
    q('[data-log]').addEventListener('click', () => this.dispatchEvent(new CustomEvent('mh:log-open')));
    q('[data-exit]').addEventListener('click', () => this.dispatchEvent(new CustomEvent('mh:logout')));
    q('[data-abandon]').addEventListener('click', () => this.dispatchEvent(new CustomEvent('mh:abandon')));
  }

  toggle(open?: boolean) {
    this.open = open ?? !this.open;
    const panel = this.root.querySelector('.panel') as HTMLElement;
    const ball = this.root.querySelector('.ball') as HTMLElement;
    panel.classList.toggle('open', this.open);
    ball.style.display = this.open ? 'none' : 'flex';
  }

  /** core 事件驱动：setState({title,dot,help,limit,recv,recLimit,recRatio,...,task}) */
  setState(s: Record<string, unknown>) {
    this.state = { ...this.state, ...s };
    this.render();
  }

  private render() {
    const q = (s: string) => this.root.querySelector(s) as HTMLElement;
    const st = this.state;
    if (st.title !== undefined) q('[data-title]').textContent = String(st.title);
    if (st.dotOff !== undefined) q('.dot').classList.toggle('off', Boolean(st.dotOff));
    if (st.help !== undefined) q('[data-help]').textContent = String(st.help);
    if (st.limit !== undefined) q('[data-limit]').textContent = String(st.limit);
    const ratio = typeof st.ratio === 'number' ? st.ratio : 0;
    (q('[data-bar]') as HTMLElement).style.width = `${Math.round(ratio * 100)}%`;
    if (st.recv !== undefined) q('[data-recv]').textContent = String(st.recv);
    if (st.recLimit !== undefined) q('[data-recLimit]').textContent = String(st.recLimit);
    const rRatio = typeof st.recRatio === 'number' ? st.recRatio : 0;
    (q('[data-recbar]') as HTMLElement).style.width = `${Math.round(rRatio * 100)}%`;
    // 任务卡
    const box = q('[data-taskbox]') as HTMLElement;
    const taskLabel = q('[data-task]') as HTMLElement;
    if (st.task) {
      box.style.display = ''; taskLabel.style.display = '';
      q('[data-song]').textContent = `▶ ${String(st.task.name ?? '—')}`;
      if (st.task.timeText) q('[data-time]').textContent = String(st.task.timeText);
      if (typeof st.task.playRatio === 'number') (q('[data-taskbar]') as HTMLElement).style.width = `${Math.round(st.task.playRatio * 100)}%`;
      if (st.hbText !== undefined) q('[data-hb]').textContent = st.hbText === '' ? '♥ 心跳 <span style="color:var(--mh-ok)">● 正常</span>' : `♥ ${st.hbText}`;
    } else {
      box.style.display = 'none'; taskLabel.style.display = 'none';
    }
    if (st.logCount !== undefined) q('[data-log]').textContent = `日志 (${Number(st.logCount)})`;
  }
}
