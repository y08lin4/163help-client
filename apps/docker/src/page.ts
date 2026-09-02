/** 管理端仪表页（统一设计系统：白卡红标灰线 + 心跳折线 + 实时日志流） */
export function buildPage({ authed }: { authed: boolean }): string {
  const isAuthed = authed;
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>网易云音乐互助 · Docker 管理端</title>
<style>
:root{--red:#EC4141;--card:#fff;--line:#E5E5E5;--t1:#333;--t2:#999;--ok:#2ea44f;--warn:#f5a623;--danger:#e5484d;}
@media (prefers-color-scheme:dark){:root{--card:#262626;--line:#3A3A3A;--t1:#eee;--t2:#aaa;}}
*{box-sizing:border-box;margin:0}body{font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#F7F7F7;color:var(--t1);min-height:100vh;padding:28px 16px;font-size:13px}
@media (prefers-color-scheme:dark){body{background:#1F1F1F}}
.wrap{max-width:680px;margin:0 auto}
h1{font-size:16px;margin-bottom:16px;color:var(--t2);font-weight:500}
.card{background:var(--card);border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,.06);padding:16px;margin-bottom:14px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.kv{display:flex;justify-content:space-between;padding:6px 0;color:var(--t2)}.kv b{color:var(--t1);font-variant-numeric:tabular-nums}
.big{font-size:22px;font-weight:700}.unit{font-size:12px;color:var(--t2);font-weight:400}
.bar{height:4px;border-radius:2px;background:#F0F0F0;overflow:hidden;margin:8px 0 4px}.bar i{display:block;height:100%;background:var(--red);border-radius:2px}
.log{background:#252525;border-radius:10px;padding:12px;font-family:Consolas,monospace;font-size:11.5px;line-height:1.7;color:#d7d7d7;max-height:220px;overflow:auto}
.log .ok{color:#7bd88f}.log .wr{color:#ffd479}.log .er{color:#ff8a8a}
input{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:8px;font-size:13px;margin-bottom:10px}
button{padding:10px 18px;border:none;border-radius:8px;background:var(--red);color:#fff;font-size:13px;cursor:pointer}
.badge{font-size:11px;padding:3px 8px;border-radius:10px;background:#F5F5F5;color:var(--t2)}
.badge.green{background:#e8f6ec;color:var(--ok)}
</style></head><body><div class="wrap">
<h1>网易云音乐互助 · Docker 管理端 v5.0</h1>
${isAuthed ? `
<div class="card"><div class="kv"><span>状态</span><b><span class="badge green">运行中</span> <span id="up">—</span></b></div>
<div class="kv"><span>今日帮听</span><b><span id="help">—</span> 秒</b></div>
<div class="kv"><span>今日被助</span><b><span id="recv">—</span> 次</b></div>
<div class="kv"><span>当前任务</span><b id="job">—</b></div></div>
<div class="card"><b style="color:var(--t2)">心跳间隔（近 30 帧）</b><svg id="hb" width="100%" height="60" viewBox="0 0 500 60" preserveAspectRatio="none"><polyline id="hbline" points="" fill="none" stroke="#EC4141" stroke-width="1.6"/></svg></div>
<div class="card"><b style="color:var(--t2)">实时日志</b><div class="log" id="log">等待数据…</div></div>
<script>
const fmt=(s)=>{const h=Math.floor(s/3600)%24,d=Math.floor(s/86400);return d?d+'d '+h+'h':h+'h '+Math.floor(s/60%60)+'m'};
async function poll(){
  try{const r=await fetch('/api/state');if(r.status===401){location.reload();return}
  const d=await r.json();document.getElementById('up').textContent=fmt(d.uptime);
  document.getElementById('help').textContent=d.helpUsed+' / '+d.helpLimit;
  document.getElementById('recv').textContent=d.recv+' / '+d.recvLimit;
  document.getElementById('job').textContent=d.job?('《'+d.job.musicName+'》 '+Math.floor(d.job.playedMs/1000)+'s'):'—';
  const pts=d.hbIntervals||[];const max=Math.max(20,...pts);
  document.getElementById('hbline').setAttribute('points',pts.map((v,i)=>((i/(Math.max(1,pts.length-1)))*500)+','+(55-(v/max)*45)).join(' '));
  const box=document.getElementById('log');
  box.innerHTML=(d.logs||[]).map(l=>'<span class="'+({warn:'wr',error:'er'}[l.level]||'ok')+'">['+new Date(l.ts).toISOString().slice(11,19)+'] '+l.msg+'</span>').join('<br>');
  box.scrollTop=box.scrollHeight;}catch(e){}
}
poll();setInterval(poll,2000);
</script>` : `
<div class="card"><h1 style="color:var(--t1)">🔐 请输入管理密码</h1>
<input id="pw" type="password" placeholder="UI_PASSWORD" onkeydown="if(event.key==='Enter')document.getElementById('btn').click()">
<button id="btn" onclick="login()">登录</button></div>
<script>
async function login(){const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:document.getElementById('pw').value})});
const d=await r.json();if(d.ok){location.reload();}else alert('密码错误');}
</script>`}
</div></body></html>`;
}
