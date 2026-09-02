/**
 * Docker 管理端（按 design-v2 稿实现：登录/仪表(3卡+任务+心跳折线+日志)/设置/空态引导）
 */
export function buildPage({ authed, configured }: { authed: boolean; configured?: boolean }): string {
  const isAuthed = authed;
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>网易云音乐互助 · Docker 管理端</title>
<style>
:root{
  --red:#EC4141;--bg:#F7F7F7;--card:#FFFFFF;--line:#E5E5E5;
  --t1:#333333;--t2:#999999;--track:#F0F0F0;
  --ok:#2ea44f;--warn:#f5a623;--danger:#e5484d;
  --r:12px;--sh:0 4px 12px rgba(0,0,0,.06);
}
@media (prefers-color-scheme:dark){
  :root{--bg:#1F1F1F;--card:#262626;--line:#3A3A3A;--t1:#EEEEEE;--t2:#AAAAAA;--track:#383838}
}
*{box-sizing:border-box;margin:0}
body{font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:var(--bg);color:var(--t1);min-height:100vh;padding:32px 16px;font-size:13px}
.wrap{max-width:860px;margin:0 auto}
.head{display:flex;align-items:center;gap:10px;margin-bottom:18px}
.brand{display:flex;align-items:center;gap:9px;font-size:15px;font-weight:700}
.logo{width:22px;height:22px;border-radius:6px;background:var(--red);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px}
.sp{flex:1}
.ver{font-size:11px;color:var(--t2)}
.tool{cursor:pointer;font-size:12.5px;padding:6px 12px;border:1px solid var(--line);border-radius:8px;background:var(--card);transition:.15s}
.tool:hover{color:var(--red);border-color:var(--red)}
.tool.ghost{color:var(--red);border-color:var(--red)}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:11px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:13px 14px}
.card.w{grid-column:1/4}
.lbl{font-size:11px;color:var(--t2);margin-bottom:6px}
.big{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums}
.big .u{font-size:11px;color:var(--t2);font-weight:400}
.bar{height:4px;border-radius:2px;background:var(--track);overflow:hidden;margin:8px 0 4px}
.bar i{display:block;height:100%;background:var(--red);border-radius:2px}
.sub2{font-size:11px;color:var(--t2)}
.badge{font-size:11px;padding:3px 9px;border-radius:10px;background:var(--track);color:var(--t2)}
.badge.green{background:#e8f6ec;color:var(--ok)}
.log{background:#252525;border-radius:10px;padding:11px 13px;font-family:Consolas,Menlo,monospace;font-size:11.5px;line-height:1.75;color:#d7d7d7;max-height:230px;overflow:auto}
.log .ok{color:#7bd88f}.log .wr{color:#ffd479}.log .er{color:#ff8a8a}
input,textarea{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:8px;font-size:13px;background:var(--card);color:var(--t1);font-family:inherit;outline:none}
input:focus,textarea:focus{border-color:var(--red)}
textarea{min-height:104px;resize:vertical}
button{padding:10px 20px;border:none;border-radius:8px;background:var(--red);color:#fff;font-size:13px;font-weight:600;cursor:pointer}
.btn.ghost{background:var(--card);color:var(--red);border:1px solid var(--red);margin-left:10px}
label{display:block;font-size:12px;color:var(--t2);margin:12px 0 6px}
.tip{font-size:11px;color:var(--t2);margin-top:10px;line-height:1.7}
.hidden{display:none!important}
.dlg{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:9}
.dlg .panel{width:540px;max-width:94vw;max-height:88vh;overflow:auto;background:var(--card);border-radius:var(--r);box-shadow:0 12px 40px rgba(0,0,0,.18);padding:20px 22px}
.login{width:320px;margin:36px auto}
</style></head><body><div class="wrap">
${isAuthed ? `
<div class="head">
  <div class="brand"><span class="logo">♪</span>网易云音乐互助</div>
  <div class="sp"></div><span class="ver">v5.0.1</span>
  <span class="tool" onclick="showCfg()">⚙ 设置</span>
  <span class="tool ghost" onclick="doLogout()">退出</span>
</div>

<div id="dash">
<div class="grid">
  <div class="card"><div class="lbl">今日帮听</div><div class="big"><span id="help">0</span><span class="u"> / <span id="helplimit">9000</span> 秒</span></div><div class="bar"><i id="helpbar" style="width:0"></i></div><div class="sub2">剩余 <span id="helpleft">9000</span> 秒</div></div>
  <div class="card"><div class="lbl">今日被助</div><div class="big"><span id="recv">0</span><span class="u"> / <span id="recvlimit">26</span> 次</span></div><div class="bar"><i id="recvbar" style="width:0"></i></div><div class="sub2">已满 <span id="recvpct">0</span>%</div></div>
  <div class="card"><div class="lbl">连续运行</div><div class="big" id="up">—</div><div class="sub2" style="margin-top:4px"><span class="badge green">运行中</span> <span id="lastlog">初始化…</span></div></div>
  <div class="card w"><div class="lbl">当前任务 · <span id="job">空闲中</span></div><div class="bar"><i id="jobbar" style="width:0"></i></div><div class="sub2" style="margin-top:4px" id="jobtime">等待任务…</div></div>
  <div class="card w"><div class="lbl">心跳间隔 · 近 30 帧 · 均值 <b id="hbavg">—</b></div>
    <svg width="100%" height="62" viewBox="0 0 500 62" preserveAspectRatio="none"><polyline id="hbline" points="" fill="none" stroke="#EC4141" stroke-width="1.8" stroke-linejoin="round"/></svg></div>
  <div class="card w"><div class="lbl">实时日志</div><div class="log" id="log">等待数据…</div></div>
  ${configured === false ? `
  <div class="card w" style="background:#FFF8F0;border-color:var(--warn)">
    <div class="lbl" style="color:#9a6700">⚠️ 尚未配置账号</div>
    <div class="sub2" style="color:#874d00">点击右上角 <b>⚙ 设置</b>，粘贴网易云 Cookie 与 portal 密钥后开始互助</div>
  </div>` : ``}
</div>
</div>

<div id="cfg" class="dlg hidden"><div class="panel">
  <div class="head" style="margin-bottom:2px">
    <div class="brand"><span class="logo">⚙</span>客户端配置</div><div class="sp"></div>
    <span class="tool" onclick="showDash()">返 回</span>
  </div>
  <label>网易云 Cookie（完整串，含 MUSIC_U=…）</label>
  <textarea id="ncookie" placeholder="MUSIC_U=…; __csrf=…; …"></textarea>
  <label>Portal 客户端密钥（mh_ck_ 开头，个人中心获取）</label>
  <input id="nkey" placeholder="mh_ck_xxxxxxxx"/>
  <div style="margin-top:14px"><button onclick="saveCfg()">保存并应用</button><button class="btn ghost" onclick="showDash()">取消</button></div>
  <div class="tip">保存后自动重启会话生效；数据持久化于 /data（升级不丢）。忘记密码 ./vps-setup.sh show-password 找回。</div>
</div></div>

<script>
const fmt=(s)=>{const d=Math.floor(s/86400),h=Math.floor(s/3600)%24,m=Math.floor(s%3600/60);return (d?d+'d ':'')+h+'h '+m+'m'};
async function poll(){
  try{
    const r=await fetch('/api/state'); if(r.status===401){location.reload();return}
    const d=await r.json();
    document.getElementById('up').textContent=fmt(d.uptime);
    document.getElementById('help').textContent=d.helpUsed||0;
    document.getElementById('helplimit').textContent=d.helpLimit||9000;
    document.getElementById('helpleft').textContent=Math.max(0,(d.helpLimit||9000)-(d.helpUsed||0));
    document.getElementById('helpbar').style.width=Math.min(100,(d.helpLimit?(d.helpUsed||0)/d.helpLimit:0)*100)+'%';
    document.getElementById('recv').textContent=d.recv||0;
    document.getElementById('recvlimit').textContent=d.recvLimit||26;
    document.getElementById('recvpct').textContent=Math.round((d.recvLimit?(d.recv||0)/d.recvLimit:0)*100);
    document.getElementById('recvbar').style.width=Math.min(100,(d.recvLimit?(d.recv||0)/d.recvLimit:0)*100)+'%';
    document.getElementById('job').textContent=d.job?('《'+d.job.musicName+'》 '+(Math.floor((d.job.playedMs||0)/1000))+'s'):'空闲中';
    if(d.job){document.getElementById('jobtime').textContent='进行中 '+(Math.floor((d.job.playedMs||0)/1000))+'s / '+Math.max(1,Math.floor((d.job.targetMs||0)/1000))+'s';document.getElementById('jobbar').style.width=Math.min(100,(d.job.playedMs/Math.max(1,d.job.targetMs))*100)+'%'}
    const pts=d.hbIntervals||[];
    if(pts.length){document.getElementById('hbavg').textContent=(pts.reduce((a,b)=>a+b,0)/pts.length).toFixed(1)+'s'}
    const max=Math.max(20,...pts);
    document.getElementById('hbline').setAttribute('points',pts.map((v,i)=>((i/(Math.max(1,pts.length-1)))*500)+','+(52-(v/max)*40)).join(' '));
    const box=document.getElementById('log');
    const rows=(d.logs&&d.logs.length)?d.logs:[{level:'info',ts:Date.now(),msg:'等待数据…（配置账号后开始互助）'}];
    box.innerHTML=rows.map(l=>'<span class="'+({warn:'wr',error:'er'}[l.level]||'ok')+'">['+new Date(l.ts).toISOString().slice(11,19)+'] '+l.msg+'</span>').join('<br>');
    box.scrollTop=box.scrollHeight;
    const last=rows[rows.length-1]; if(last)document.getElementById('lastlog').textContent=last.msg;
  }catch(e){}
}
function showCfg(){document.getElementById('dash').classList.add('hidden');document.getElementById('cfg').classList.remove('hidden')}
function showDash(){document.getElementById('cfg').classList.add('hidden');document.getElementById('dash').classList.remove('hidden')}
async function saveCfg(){const r=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cookie:document.getElementById('ncookie').value,key:document.getElementById('nkey').value})});(await r.json()).ok&&alert('✅ 已保存并应用');showDash()}
async function doLogout(){await fetch('/api/logout',{method:'POST'});location.reload()}
poll();setInterval(poll,2000);
</script>` : `
<div class="head">
  <div class="brand"><span class="logo">♪</span>网易云音乐互助</div><div class="sp"></div><span class="ver">v5.0.1</span>
</div>
<div class="login"><div class="card" style="padding:18px 20px">
  <div style="font-weight:600;margin-bottom:12px">🔐 请输入管理密码</div>
  <input id="pw" type="password" placeholder="UI_PASSWORD" style="margin-bottom:12px" onkeydown="if(event.key==='Enter')document.getElementById('btn').click()"/>
  <button id="btn" onclick="login()" style="width:100%">登 录</button>
  <div class="tip">忘记密码：./vps-setup.sh show-password</div>
</div></div>
<script>
async function login(){const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:document.getElementById('pw').value})});const d=await r.json();d.ok?location.reload():alert('密码错误')}
</script>`}
</div></body></html>`;
}
