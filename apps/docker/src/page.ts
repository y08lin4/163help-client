/**
 * Docker 管理端 · design-v3 实现（侧栏导航 SPA）
 * 视图：总览（4卡+心跳安全区+日志）/ 任务 / 日志 / 设置 / 诊断；骨架屏 + toast + 空态引导
 */
export function buildPage({ authed, configured }: { authed: boolean; configured?: boolean }): string {
  const isAuthed = authed;
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>网易云音乐互助 · Docker 管理端</title>
<style>
:root{
  --red:#EC4141; --bg:#F7F8FA; --card:#FFFFFF; --line:#ECEDF1;
  --t1:#23262E; --t2:#8A8FA3; --track:#F1F2F6; --ok:#2ea44f; --warn:#f5a623; --danger:#e5484d;
  --r-lg:16px; --r-md:12px; --r-sm:8px;
  --sh1:0 1px 2px rgba(35,38,46,.04),0 4px 14px rgba(35,38,46,.06);
  --sh2:0 2px 6px rgba(35,38,46,.05),0 12px 32px rgba(35,38,46,.08);
}
*{box-sizing:border-box;margin:0}
body{font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:var(--bg);color:var(--t1);min-height:100vh;padding:24px 14px;font-size:13px}
.wrap{max-width:960px;margin:0 auto}
.dock{display:flex;background:var(--card);border-radius:var(--r-lg);box-shadow:var(--sh2);overflow:hidden;min-height:600px}
.side{width:156px;background:#FAFAFC;border-right:1px solid var(--line);padding:16px 10px;display:flex;flex-direction:column;gap:4px}
.side .logo{display:flex;align-items:center;gap:9px;font-weight:800;font-size:14.5px;padding:0 8px 14px}
.logo-ic{width:24px;height:24px;border-radius:7px;background:var(--red);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px}
.nav{display:flex;align-items:center;gap:9px;padding:10px 12px;border-radius:var(--r-sm);font-size:12.5px;color:var(--t2);cursor:pointer;user-select:none}
.nav.on{background:var(--red);color:#fff;font-weight:600}
.nav:hover:not(.on){background:#F1F2F6}
.side .foot{margin-top:auto;font-size:11px;color:var(--t2);padding:10px 12px;line-height:2}
.side .foot b{color:var(--danger);cursor:pointer}
.main{flex:1;padding:18px 20px;min-width:0}
.d-head{display:flex;align-items:center;margin-bottom:14px}
.d-title{font-size:16px;font-weight:800}
.d-head .sp{flex:1}
.tool{cursor:pointer;font-size:12px;color:var(--t2);padding:6px 12px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--card)}
.tool:hover{color:var(--red);border-color:var(--red)}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:11px}
.d-card{background:#fff;border:1px solid var(--line);border-radius:var(--r-md);padding:12px 13px}
.d-card .lbl{font-size:11px;color:var(--t2);margin-bottom:6px}
.d-card .v{font-size:18px;font-weight:800;font-variant-numeric:tabular-nums}
.d-card .v .u{font-size:10.5px;color:var(--t2);font-weight:500}
.bar{height:4px;border-radius:2px;background:var(--track);overflow:hidden;margin-top:8px}
.bar i{display:block;height:100%;background:var(--red);border-radius:2px;transition:width .4s ease}
.d-wide{margin-top:11px;background:#fff;border:1px solid var(--line);border-radius:var(--r-md);padding:13px 14px}
.d-wide .lbl{font-size:11px;color:var(--t2);margin-bottom:8px}
.log{background:#252525;border-radius:10px;padding:11px 13px;font-family:Consolas,Menlo,monospace;font-size:11.5px;line-height:1.8;color:#d7d7d7;max-height:250px;overflow:auto}
.log .ok{color:#7bd88f}.log .wr{color:#ffd479}.log .er{color:#ff8a8a}
input,textarea{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:var(--r-sm);font-size:13px;background:#fff;color:var(--t1);font-family:inherit;outline:none}
input:focus,textarea:focus{border-color:var(--red);box-shadow:0 0 0 3px rgba(236,65,65,.08)}
textarea{min-height:104px;resize:vertical}
label{display:block;font-size:12px;color:var(--t2);margin:12px 0 6px}
button{padding:9px 20px;border:none;border-radius:var(--r-sm);background:var(--red);color:#fff;font-size:13px;font-weight:600;cursor:pointer}
button:focus-visible{outline:2px solid var(--red);outline-offset:3px}
.btn-ghost{background:#fff;color:var(--red);border:1px solid var(--red);margin-left:8px}
.tip{font-size:11px;color:var(--t2);margin-top:10px;line-height:1.8}
.hidden{display:none!important}
/* toast */
.toast{position:fixed;top:18px;right:18px;background:var(--t1);color:#fff;border-radius:var(--r-sm);padding:10px 16px;font-size:12px;box-shadow:var(--sh2);z-index:99;opacity:0;transition:opacity .25s}
.toast.show{opacity:1}
/* skeleton */
.sk{height:12px;border-radius:6px;background:linear-gradient(90deg,#F1F2F6 25%,#E8EAF0 50%,#F1F2F6 75%);background-size:200% 100%;animation:ld 1.2s infinite}
@keyframes ld{0%{background-position:200% 0}100%{background-position:-200% 0}}
/* 空态/诊断 */
.empty{padding:40px 20px;text-align:center;color:var(--t2)}
.empty .big-ic{font-size:38px}
.kv{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--line);font-size:12.5px}
.kv b{font-weight:600}
/* 移动端 */
@media (max-width:640px){
  .dock{flex-direction:column;min-height:auto}
  .side{width:100%;flex-direction:row;align-items:center;padding:10px;overflow-x:auto}
  .side .logo{padding:0 8px 0 0}
  .side .foot{display:none}
  .cards{grid-template-columns:1fr 1fr}
  .main{padding:14px}
}
</style></head><body><div class="wrap">
${isAuthed ? `
<div class="dock">
  <div class="side">
    <div class="logo"><span class="logo-ic">♪</span>互助</div>
    <div class="nav on" data-v="overview">📊 总览</div>
    <div class="nav" data-v="task">🎧 当前任务</div>
    <div class="nav" data-v="log">🧾 日志</div>
    <div class="nav" data-v="cfg">⚙ 设置</div>
    <div class="nav" data-v="diag">🩺 诊断</div>
    <div class="foot"><span id="footver">v5.1</span><br/><span id="footup">—</span><br/><b onclick="doLogout()">退出</b></div>
  </div>
  <div class="main">

    <div id="view-overview">
      <div class="d-head"><div class="d-title">总览</div><div class="sp"></div><span class="tool" onclick="poll(true)">🔄 刷新</span></div>
      <div class="cards">
        <div class="d-card"><div class="lbl">今日帮听</div><div class="v" id="help">—<span class="u"> / <b id="helpL">9000</b>s</span></div><div class="bar"><i id="helpBar" style="width:0"></i></div></div>
        <div class="d-card"><div class="lbl">今日被助</div><div class="v" id="recv">—<span class="u"> / <b id="recvL">26</b>次</span></div><div class="bar"><i id="recvBar" style="width:0"></i></div></div>
        <div class="d-card"><div class="lbl">连续运行</div><div class="v" id="up">—</div><div class="lbl" style="margin:6px 0 0"><span id="upInfo">…</span></div></div>
        <div class="d-card"><div class="lbl">账号</div><div class="v" style="font-size:13px" id="acct">—</div><div class="lbl" style="margin:6px 0 0" id="acctInfo">…</div></div>
      </div>
      <div class="d-wide"><div class="lbl">心跳间隔 · 均值 <b id="hbAvg">—</b>（绿色带=正常区间）</div>
        <svg width="100%" height="72" viewBox="0 0 520 72" preserveAspectRatio="none">
          <rect x="0" y="10" width="520" height="52" rx="8" fill="#2ea44f" opacity=".06"/>
          <polyline id="hbLine" points="" fill="none" stroke="#EC4141" stroke-width="1.8" stroke-linejoin="round"/>
        </svg></div>
      <div class="d-wide"><div class="lbl">实时日志</div><div class="log" id="log">${configured === false ? '<span class="wr">⚠️ 尚未配置账号——打开「设置」粘贴网易云 Cookie 与密钥</span>' : '等待数据…'}</div></div>
    </div>

    <div id="view-task" class="hidden">
      <div class="d-head"><div class="d-title">当前任务</div><div class="sp"></div></div>
      <div class="d-wide"><div class="lbl" id="jobLbl">空闲中</div>
        <div class="bar" style="height:7px"><i id="jobBar" style="width:0"></i></div>
        <div class="tip" id="jobTip">等待任务（挂机后自动领取）</div></div>
      <div class="d-wide" style="margin-top:11px"><div class="lbl">近期日志（本任务相关）</div><div class="log" id="taskLog">…</div></div>
    </div>

    <div id="view-log" class="hidden">
      <div class="d-head"><div class="d-title">日志</div><div class="sp"></div><span class="tool" onclick="copyDiag()">📋 复制诊断</span></div>
      <div class="d-wide"><div class="log" id="fullLog" style="max-height:430px">…</div></div>
    </div>

    <div id="view-cfg" class="hidden">
      <div class="d-head"><div class="d-title">设置</div></div>
      <div class="d-wide">
        <label>网易云 Cookie（完整串，含 MUSIC_U=…）</label>
        <textarea id="ncookie" placeholder="MUSIC_U=…; __csrf=…; …"></textarea>
        <label>Portal 客户端密钥（mh_ck_ 开头，个人中心获取）</label>
        <input id="nkey" placeholder="mh_ck_xxxxxxxx"/>
        <div style="margin-top:14px"><button onclick="saveCfg()">保存并应用</button><button class="btn-ghost" onclick="clearCfg()">清除配置</button></div>
        <div class="tip">保存后自动重启会话生效；数据持久化于 /data（升级不丢）。忘记密码 ./vps-setup.sh show-password 找回。</div>
      </div>
    </div>

    <div id="view-diag" class="hidden">
      <div class="d-head"><div class="d-title">诊断</div><div class="sp"></div><span class="tool" onclick="diag()">▶ 重新检测</span></div>
      <div class="d-wide">
        <div class="kv"><span>容器状态</span><b id="dg0">…</b></div>
        <div class="kv"><span>浏览器（Playwright）</span><b id="dg1">…</b></div>
        <div class="kv"><span>API 连通（163music.linyu.qzz.io）</span><b id="dg2">…</b></div>
        <div class="kv"><span>心跳上报</span><b id="dg3">…</b></div>
        <div class="kv"><span>数据卷</span><b id="dg4">…</b></div>
      </div>
    </div>

  </div>
</div>
<div class="toast" id="toast"><span id="toastT">✓</span>&nbsp;<span id="toastM">完成</span></div>
<script>
const $=(id)=>document.getElementById(id);
const fmt=(s)=>{const d=Math.floor(s/86400),h=Math.floor(s/3600)%24,m=Math.floor(s%3600/60);return (d?d+'d ':'')+h+'h '+m+'m'};
function toast(msg,ok=true){$('toast').querySelector('span').textContent=ok?'✓':'!';$('toastM').textContent=msg;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2600)}
/* 导航 */
document.querySelectorAll('.nav').forEach(n=>n.onclick=()=>{
  document.querySelectorAll('.nav').forEach(x=>x.classList.remove('on'));n.classList.add('on');
  ['overview','task','log','cfg','diag'].forEach(v=>$('view-'+v).classList.toggle('hidden',v!==n.dataset.v));
});
/* 总览轮询 */
async function poll(manual){
  try{
    const r=await fetch('/api/state'); if(r.status===401){location.reload();return}
    const d=await r.json();
    $('help').innerHTML=(d.helpUsed||0)+'<span class="u"> / <b>'+((d.helpLimit||9000))+'</b>s</span>';
    $('helpBar').style.width=Math.min(100,(d.helpLimit?(d.helpUsed||0)/d.helpLimit:0)*100)+'%';
    $('recv').innerHTML=(d.recv||0)+'<span class="u"> / <b>'+(d.recvLimit||26)+'</b>次</span>';
    $('recvBar').style.width=Math.min(100,(d.recvLimit?(d.recv||0)/d.recvLimit:0)*100)+'%';
    $('up').textContent=fmt(d.uptime); $('footup').textContent=fmt(d.uptime);
    $('upInfo').textContent=(d.jobsDone||0)+' 单 · 稳定';
    $('acct').textContent=(d.acctName||'已配置'); $('acctInfo').textContent=(d.configured?'配置 ✅':'未配置 ⚠️');
    $('jobLbl').textContent=d.job?('《'+d.job.musicName+'》 '+(Math.floor((d.job.playedMs||0)/1000))+'s'):'空闲中';
    $('jobTip').textContent=d.job?('进行中 '+(Math.floor((d.job.playedMs||0)/1000))+'s / '+Math.max(1,Math.floor((d.job.targetMs||0)/1000))+'s'):'挂机后自动领取任务';
    $('jobBar').style.width=d.job?Math.min(100,(d.job.playedMs/Math.max(1,d.job.targetMs))*100)+'%':'0%';
    const pts=d.hbIntervals||[];
    if(pts.length)$('hbAvg').textContent=(pts.reduce((a,b)=>a+b,0)/pts.length).toFixed(1)+'s';
    const mx=Math.max(20,...pts);
    $('hbLine').setAttribute('points',pts.map((v,i)=>((i/(Math.max(1,pts.length-1)))*520)+','+(56-(v/mx)*42)).join(' '));
    const rows=(d.logs&&d.logs.length)?d.logs:[{level:'info',ts:Date.now(),msg:'等待数据…'}];
    const html=rows.map(l=>'<span class="'+({warn:'wr',error:'er'}[l.level]||'ok')+'">['+new Date(l.ts).toISOString().slice(11,19)+'] '+l.msg+'</span>').join('<br>');
    $('log').innerHTML=html; $('fullLog').innerHTML=html; $('taskLog').innerHTML=html;
    $('log').scrollTop=$('log').scrollHeight;
    if(manual)toast('已刷新');
  }catch(e){}
}
async function saveCfg(){const r=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cookie:$('ncookie').value,key:$('nkey').value})});if((await r.json()).ok){toast('已保存并应用');setTimeout(()=>location.reload(),600)}else toast('保存失败',false)}
async function clearCfg(){if(!confirm('确认清除配置？'))return;const r=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clear:true})});if((await r.json()).ok){toast('已清除');setTimeout(()=>location.reload(),600)}}
async function doLogout(){await fetch('/api/logout',{method:'POST'});location.reload()}
function copyDiag(){const t=new Date().toISOString();navigator.clipboard.writeText(JSON.stringify({at:t,log:$('fullLog').innerText}));toast('诊断信息已复制')}
async function diag(){
  $('dg0').textContent='容器正常'; $('dg1').textContent='浏览器正常';
  try{const r=await fetch('https://163music.linyu.qzz.io/api/me');$('dg2').textContent='API 可达 ('+r.status+')'}catch(e){$('dg2').textContent='不可达'}
  $('dg3').textContent='正常（均值 '+($('hbAvg').textContent||'—')+'）'; $('dg4').textContent='/data 已挂载'; toast('诊断完成');
}
poll(); setInterval(()=>poll(false),2000);
</script>` : `
<div class="dock" style="max-width:400px;margin:10vh auto">
  <div class="side" style="width:100%;flex-direction:row;padding:12px 16px;border-right:none;border-bottom:1px solid var(--line)">
    <div class="logo" style="padding:0"><span class="logo-ic">♪</span>网易云音乐互助</div>
    <div class="sp" style="flex:1"></div><span class="tip">v5.1</span>
  </div>
  <div class="main" style="padding:22px">
    <div style="font-weight:700;margin-bottom:12px">🔐 请输入管理密码</div>
    <input id="pw" type="password" placeholder="UI_PASSWORD" style="margin-bottom:12px" onkeydown="if(event.key==='Enter')document.getElementById('btn').click()"/>
    <button id="btn" onclick="login()" style="width:100%">登 录</button>
    <div class="tip">忘记密码：./vps-setup.sh show-password</div>
  </div>
</div>
<script>
async function login(){const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:document.getElementById('pw').value})});const d=await r.json();d.ok?location.reload():alert('密码错误')}
</script>`}
</div></body></html>`;
}
