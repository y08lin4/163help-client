// popup.js —— 扩展 popup 逻辑（MV3 外部脚本，无内联 script）
// 状态来源：content 每 30s 写入 chrome.storage.local 的 mh_snapshot；账号来自 mh_user。
'use strict';

const el = (id) => document.getElementById(id);

const ORIG_TEXT = {
  open: '打开互助页面',
  copy: '复制诊断信息',
  toggle: '展开面板 / 隐藏面板',
};

const state = { snapshot: null, user: null };

// —— 工具 ——
function fmt(n) {
  if (n === undefined || n === null || n === '') return '—';
  const v = Number(n);
  if (isNaN(v)) return String(n);
  return v.toLocaleString('en-US');
}

function maskName(name) {
  const s = String(name || '').trim();
  if (!s) return '**';
  return s.length <= 1 ? `${s}***` : `${s.slice(0, 1)}***`;
}

// 简化 UA，如 "Chrome 138 · Windows"
function simplifyUA(ua) {
  if (!ua) return 'Chrome';
  const m = ua.match(/(Edg|Chrome|Firefox|Safari)\/(\d+)/);
  let browser = 'Chrome';
  if (m) {
    const name = m[1] === 'Edg' ? 'Edge' : m[1];
    browser = `${name} ${m[2]}`;
  }
  let os = 'Unknown';
  if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  return `${browser} · ${os}`;
}

// —— 渲染：A 态（有快照且在线）/ B 态（无快照或离线）互斥 ——
function setOnline(online) {
  const dot = el('dot');
  const badge = el('badge');
  if (!dot || !badge) return;
  dot.classList.toggle('off', !online);
  badge.classList.toggle('g', online);
  badge.textContent = online ? '在线' : '未同步';
}

function render(snapshot) {
  const online = !!(snapshot && snapshot.online);
  setOnline(online);
  el('stateA').classList.toggle('hidden', !online);
  el('stateB').classList.toggle('hidden', online);
  if (online) {
    el('today').textContent = `${fmt(snapshot.todaySec)} / ${fmt(snapshot.todayGoal)} 秒`;
    const name = snapshot.taskName ? String(snapshot.taskName).trim() : '';
    const pos = snapshot.taskPos ? String(snapshot.taskPos).trim() : '';
    el('task').textContent = name ? `《${name}》 ${pos || '—'}` : '—';
    el('helped').textContent = `${fmt(snapshot.helped)} / ${fmt(snapshot.helpedTotal)} 次`;
  }
}

// —— 脱敏诊断文本（11 行正文 + 尾注；无快照时数值填「—」，不虚构）——
function buildDiagText(snapshot, user) {
  const online = !!(snapshot && snapshot.online);
  const dn = user && user.displayName ? user.displayName : '';
  const account = dn ? `已登录 · 昵称${maskName(dn)}` : '未登录';
  const hb = snapshot && snapshot.heartbeat ? String(snapshot.heartbeat) : '—';
  return [
    '🎧 网易云音乐互助客户端诊断',
    '──────────────────────',
    '版本     : 5.1 (extension)',
    `浏览器  : ${simplifyUA(navigator.userAgent)}`,
    `账号    : ${account}`,
    '服务器  : 163music.linyu.qzz.io',
    `状态    : ${online ? '互助中' : '未在线'}`,
    `心跳    : ${hb}`,
    `今日    : ${snapshot ? `${fmt(snapshot.todaySec)} / ${fmt(snapshot.todayGoal)} 秒` : '— / — 秒'}`,
    `被帮助  : ${snapshot ? `${fmt(snapshot.helped)} / ${fmt(snapshot.helpedTotal)} 次` : '— / — 次'}`,
    '设置    : autoStart=1 onlyHelp=0 autoCollapse=0 logReport=1',
    '（token / 登录态已脱敏）',
  ].join('\n');
}

// —— 按钮提示短闪（临时改文本，1.5s 后恢复）——
function flash(id, text) {
  const b = el(id);
  if (!b) return;
  b.textContent = text;
  setTimeout(() => {
    const cur = el(id);
    if (cur) cur.textContent = ORIG_TEXT[id] || cur.textContent;
  }, 1500);
}

// —— 按钮行为 ——
async function onOpen() {
  const tabs = await chrome.tabs.query({ url: 'https://music.163.com/*' });
  if (tabs[0]) chrome.tabs.update(tabs[0].id, { active: true });
  else chrome.tabs.create({ url: 'https://music.163.com/', muted: true });
}

async function onCopy() {
  try {
    const text = buildDiagText(state.snapshot, state.user);
    await navigator.clipboard.writeText(text);
    flash('copy', '已复制 ✓');
  } catch (e) {
    flash('copy', '复制失败');
  }
}

async function refreshToggle() {
  const btn = el('toggle');
  if (!btn) return;
  try {
    const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isMusic = !!t && !!t.url && t.url.indexOf('music.163.com') !== -1;
    btn.disabled = !isMusic;
  } catch (e) {
    btn.disabled = false;
  }
}

async function onToggle() {
  try {
    const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!t || !t.url || t.url.indexOf('music.163.com') === -1) {
      el('toggle').disabled = true;
      return;
    }
    await chrome.tabs.sendMessage(t.id, { type: 'mh:toggle' });
  } catch (e) {
    flash('toggle', '面板页未打开');
  }
}

function bindButtons() {
  el('open').addEventListener('click', onOpen);
  el('copy').addEventListener('click', onCopy);
  el('toggle').addEventListener('click', onToggle);
}

// —— 初始化：读快照 + 账号 + 监听实时刷新 ——
async function init() {
  let res;
  try {
    res = await chrome.storage.local.get(['mh_snapshot', 'mh_user']);
  } catch (e) {
    res = {};
  }
  state.snapshot = res.mh_snapshot || null;
  state.user = res.mh_user || null;
  render(state.snapshot);
  refreshToggle();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.mh_snapshot) return;
  state.snapshot = changes.mh_snapshot.newValue || null;
  render(state.snapshot);
});

bindButtons();
init();
