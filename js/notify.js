// 通知鈴鐺：目前版本的更新內容、新版本偵測
/* ---------- notifications (鈴鐺) ---------- */
const NOTICE_KEY='fenguan-notice',DAY=86400000;
function notice(){try{return JSON.parse(localStorage.getItem(NOTICE_KEY))||{}}catch(e){return {}}}
function setNotice(n){try{localStorage.setItem(NOTICE_KEY,JSON.stringify(n))}catch(e){}}
const unseen=()=>notice().v!==APP_VERSION;                       // updated but not opened yet
function notesVisible(){const n=notice();return n.v===APP_VERSION&&!n.cleared&&Date.now()-(n.seenAt||0)<DAY}
let newVer=null,lastCheck=0;
function updateBell(){const b=document.getElementById('bell');if(b){const on=unseen()||!!newVer;b.classList.toggle('has',on);b.setAttribute('aria-label',on?'通知（有新通知）':'通知')}}
const TAGS={new:'新功能',imp:'改善',fix:'修正'},TAG_ORDER=['new','imp','fix'];
// 一個版本的更新項目，依新功能、改善、修正排序（通知面板與開發者選項的更新紀錄共用）
function relList(items){
  const l=items.slice().sort((a,b)=>TAG_ORDER.indexOf(a.t)-TAG_ORDER.indexOf(b.t));
  return `<ul>${l.map(it=>`<li><span class="ntag ${it.t}">${TAGS[it.t]||'更新'}</span><span>${esc(it.s)}</span></li>`).join('')}</ul>`;
}
function noticeHtml(){
  const notes=notesVisible();
  let html=`<div class="ntop"><b>通知</b><button class="nclr" data-action="nclear" aria-label="清除通知並關閉">✕</button></div>`;
  if(newVer)html+=`<div class="upd"><div>有新版本 <b>${esc(newVer)}</b> 可以更新</div><button data-action="reloadapp">點此重新載入</button></div>`;
  const rel=CHANGELOG[0];
  if(notes&&rel)html+=`<div class="rel"><div class="rh"><b>${esc(rel.v)} 更新內容</b><span>${esc(rel.date)}</span></div>${relList(rel.items)}</div>`;
  if(!notes&&!newVer)html+='<div class="nempty">目前沒有通知</div>';
  return html;
}
function openNotice(){
  if(unseen())setNotice({v:APP_VERSION,seenAt:Date.now(),cleared:false}); // the 24-hour clock starts on first view
  openSheet(noticeHtml());updateBell();
}
// look for a newer deploy when the app comes back to the foreground (at most every 15 minutes)
async function checkUpdate(force){
  if(!navigator.onLine||(!force&&Date.now()-lastCheck<15*60000))return;
  lastCheck=Date.now();
  try{
    const r=await fetch('./js/config.js',{cache:'no-store'});if(!r.ok)return;
    const m=(await r.text()).match(/APP_VERSION='([^']+)'/);
    if(m&&m[1]!==APP_VERSION){newVer=m[1];updateBell()}
  }catch(e){}
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkUpdate()});
