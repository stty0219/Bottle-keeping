// App 內回報問題：送出回報（含圖片壓縮）、我的回報、開發者的回報管理、鈴鐺通知
// Firestore：reports/{id}（回報）、reports/{id}/images/{0..2}（壓縮後的 JPEG，base64）
const RPT_TYPES={bug:'問題',idea:'建議',other:'其他'};
const RPT_AREAS=['總覽','明細','記帳','月結算','共用罐','設定','其他'];
const RPT_STATUS={new:'未讀',read:'已讀',doing:'處理中',done:'已解決',wontfix:'不處理'};
const RPT_ISSUE_URL='https://github.com/stty0219/Bottle-keeping/issues/';
const RPT_SEEN_KEY='fenguan-rptseen'; // 回報者在這台裝置已看過的進度 {reportId: sig}
const RPT_MAX_IMGS=3,RPT_IMG_MAX=700*1024,RPT_MAX_ERR=10;
const Rpt={list:[],loaded:false,unsub:null,err:'',imgs:{},filter:'all',sending:false};
let rptDraft=null; // 回報表單：{type, imgs[], busy}

function isDev(){return !!(Cloud.user&&Cloud.user.uid===DEV_UID)}
const rptTs=v=>v&&v.toMillis?v.toMillis():(typeof v==='number'?v:Date.now());
function rptDate(v,time){
  const d=new Date(rptTs(v)),p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`+(time?` ${p(d.getHours())}:${p(d.getMinutes())}`:'');
}
const rptById=id=>Rpt.list.find(r=>r.id===id)||null;
const rptRef=id=>Cloud.fs.collection('reports').doc(id);
function myReports(){const u=Cloud.user;return u?Rpt.list.filter(r=>r.uid===u.uid):[]}

/* ---------- 監聽：一般帳號只讀自己的回報，開發者讀全部（登入時開始、登出時停止） ---------- */
function startReports(){
  stopReports();
  const u=Cloud.user;if(!u||!Cloud.fs)return;
  const col=Cloud.fs.collection('reports');
  Rpt.unsub=(isDev()?col:col.where('uid','==',u.uid)).onSnapshot(qs=>{
    Rpt.err='';
    Rpt.list=qs.docs.map(d=>Object.assign({},d.data({serverTimestamps:'estimate'}),{id:d.id}))
      .sort((a,b)=>rptTs(b.createdAt)-rptTs(a.createdAt));
    if(!Rpt.loaded){Rpt.loaded=true;rptBaseline()}
    rptRefresh();
  },e=>{Rpt.err='無法讀取回報（'+(e.code||e.message||'')+'）';Rpt.loaded=true;rptRefresh()});
}
function stopReports(){
  if(Rpt.unsub)try{Rpt.unsub()}catch(e){}
  Object.assign(Rpt,{unsub:null,list:[],loaded:false,err:'',imgs:{}});
  rptRefresh();
}
function rptRefresh(){
  updateBell();renderIfSettings();
  if(document.getElementById('dev')&&(devView==='home'||devView==='reports'))devRender(true);
}

/* ---------- 回報者的進度通知：狀態（未讀、已讀視為沒有進度）、issue、修正版本、回覆 ---------- */
const rptSig=r=>[r.status==='read'?'new':r.status,r.issue||'',r.fixedIn||'',r.reply||''].join('|');
function rptSeen(){try{const v=JSON.parse(localStorage.getItem(RPT_SEEN_KEY));return v&&typeof v==='object'?v:null}catch(e){return null}}
function rptSeenSave(m){try{localStorage.setItem(RPT_SEEN_KEY,JSON.stringify(m))}catch(e){}}
// 這台裝置第一次載入：現有的進度都當作看過，換手機時不會跳出一堆舊通知
function rptBaseline(){if(rptSeen())return;const m={};for(const r of myReports())m[r.id]=rptSig(r);rptSeenSave(m)}
function rptHasNews(r){
  if(isDev())return false; // 進度是開發者自己改的
  const s=rptSig(r);if(s==='new|||')return false;
  return (rptSeen()||{})[r.id]!==s;
}
function rptMarkSeen(ids){const m=rptSeen()||{};for(const r of myReports())if(!ids||ids.includes(r.id))m[r.id]=rptSig(r);rptSeenSave(m)}
const rptNewsCount=()=>myReports().filter(rptHasNews).length;
const rptUnread=()=>isDev()?Rpt.list.filter(r=>r.status==='new').length:0;

/* ---------- 列表 ---------- */
function rptFirstLine(r){return (String(r.text||'').split('\n').find(s=>s.trim())||'（沒有內容）').trim()}
const rptTypeTag=t=>`<span class="rtag ty-${esc(t)}">${RPT_TYPES[t]||'其他'}</span>`;
const rptStTag=s=>`<span class="rtag st-${esc(s)}">${RPT_STATUS[s]||esc(s)}</span>`;
function rptRow(r,attrs,mark,who){
  return `<button class="rrow${mark?' mark':''}" ${attrs}>
    <span class="rtop">${rptTypeTag(r.type)}<span class="rfirst">${esc(rptFirstLine(r))}</span>${mark?'<span class="rdot" aria-label="有更新"></span>':''}</span>
    <span class="rmeta"><span>${rptDate(r.createdAt)}</span>${who?`<span class="rwho">${esc(r.name||r.email||'')}</span>`:''}${rptStTag(r.status)}</span></button>`;
}

/* ---------- 設定頁「關於與回報」 ---------- */
function aboutHtml(){
  let h='<p class="note" style="margin-top:0">遇到問題或有想法，可以直接告訴開發者。回報不會包含任何記帳資料或金額。</p>';
  if(!cloudConfigured()||!Cloud.user)return h+'<p class="rpt-login">登入後才能回報問題</p>';
  h+='<button class="gbtn rpt-new" data-action="rptnew">回報問題</button><h3 class="sec-sub">我的回報</h3>';
  if(Rpt.err)return h+`<p class="note" style="color:var(--neg)">${esc(Rpt.err)}</p>`;
  if(!Rpt.loaded)return h+'<p class="note">載入中…</p>';
  const mine=myReports();
  return h+(mine.length?`<div class="rlist">${mine.map(r=>rptRow(r,`data-action="rptview" data-id="${r.id}"`,rptHasNews(r))).join('')}</div>`:'<p class="note">還沒有回報。</p>');
}
function aboutSum(){return Cloud.user&&Rpt.loaded&&myReports().length?`${myReports().length} 則回報`:''}
function aboutBadge(){return rptNewsCount()?'有新進度':''}
// 從鈴鐺前往：切到設定頁、展開分區並捲到那裡
function gotoMyReports(){
  closeSheet();
  const keys=setOpenKeys();if(!keys.includes('about'))setOpenSave(keys.concat(['about']));
  tab='settings';render();
  const h=document.querySelector('.sec-h[data-k="about"]');if(h)h.scrollIntoView({block:'start'});
}

/* ---------- 回報表單 ---------- */
function openRptForm(){
  if(!Cloud.user){toast('登入後才能回報問題');return}
  rptDraft={type:'bug',imgs:[],busy:0};
  openSheet(`<div class="ntop"><b>回報問題</b><button class="nclr" data-action="close" aria-label="關閉">✕</button></div>
  <div class="rform">
    <div class="filters" role="group" aria-label="類別">${Object.entries(RPT_TYPES).map(([k,l])=>`<button class="chip" data-action="rpttype" data-t="${k}" aria-pressed="${k==='bug'}">${l}</button>`).join('')}</div>
    <label class="f">相關功能（選填）<select id="rarea"><option value="">不指定</option>${RPT_AREAS.map(a=>`<option>${a}</option>`).join('')}</select></label>
    <label class="f">內容<textarea class="rta" id="rtext" rows="6" maxlength="5000" placeholder="發生了什麼事？在哪個畫面、做了什麼操作？"></textarea></label>
    <div><div class="note">圖片（最多 ${RPT_MAX_IMGS} 張）</div><div class="rthumbs" id="rthumbs"></div>
      <input type="file" id="rptFile" accept="image/*" multiple class="hidden"></div>
    <label class="rchk"><input type="checkbox" id="rdiag" checked><span>一併附上版本、裝置資訊與診斷紀錄<small>取消勾選時只附上 App 版本。</small></span></label>
    <button class="primary" style="margin-top:0" id="rsend" data-action="rptsend">送出</button>
  </div>`);
  rptThumbs();
}
function rptSetType(t){
  if(!rptDraft||!RPT_TYPES[t])return;rptDraft.type=t;
  document.querySelectorAll('[data-action=rpttype]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===t));
}
function rptThumbs(){
  const el=document.getElementById('rthumbs'),d=rptDraft;if(!el||!d)return;
  el.innerHTML=d.imgs.map((b,i)=>`<div class="rth"><img src="data:image/jpeg;base64,${b}" alt="圖片 ${i+1}"><button class="rth-x" data-action="rptimgdel" data-i="${i}" aria-label="刪除圖片 ${i+1}">✕</button></div>`).join('')
    +(d.busy?'<div class="rth rth-busy">處理中…</div>':'')
    +(d.imgs.length+(d.busy?1:0)<RPT_MAX_IMGS?'<button class="rth rth-add" data-action="rptpick" aria-label="加入圖片">＋</button>':'');
}
function rptDelImg(i){if(rptDraft){rptDraft.imgs.splice(+i,1);rptThumbs()}}
async function rptAddFiles(files){
  const d=rptDraft;if(!d)return;
  const room=RPT_MAX_IMGS-d.imgs.length,list=[...files].slice(0,Math.max(0,room));
  if(files.length>room)toast(`每次回報最多 ${RPT_MAX_IMGS} 張圖片`);
  if(!list.length)return;
  d.busy++;rptThumbs();
  for(const f of list){
    try{const b=await compressImage(f);if(d.imgs.length<RPT_MAX_IMGS)d.imgs.push(b)}
    catch(e){toast('有一張圖片無法讀取')}
  }
  d.busy--;if(d===rptDraft)rptThumbs();
}
function loadImg(file){
  return new Promise((ok,no)=>{
    const url=URL.createObjectURL(file),im=new Image();
    im.onload=()=>{ok(im);setTimeout(()=>URL.revokeObjectURL(url),0)};
    im.onerror=()=>{URL.revokeObjectURL(url);no(new Error('image'))};
    im.src=url;
  });
}
// 長邊縮到 1280、JPEG 品質 0.7；超過 700KB 再降低品質，仍太大就縮小尺寸。回傳不含前綴的 base64
async function compressImage(file){
  const im=await loadImg(file),W=im.naturalWidth,H=im.naturalHeight;
  if(!W||!H)throw new Error('image');
  for(const side of [1280,960,720]){
    const k=Math.min(1,side/Math.max(W,H)),w=Math.max(1,Math.round(W*k)),h=Math.max(1,Math.round(H*k));
    const c=document.createElement('canvas');c.width=w;c.height=h;
    const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,w,h);g.drawImage(im,0,0,w,h);
    for(const q of [0.7,0.6,0.5,0.4]){const b=c.toDataURL('image/jpeg',q).split(',')[1]||'';if(b&&b.length<=RPT_IMG_MAX)return b}
  }
  throw new Error('too big');
}
function deviceInfo(){
  let standalone=!!navigator.standalone;try{standalone=standalone||matchMedia('(display-mode: standalone)').matches}catch(e){}
  return {ua:navigator.userAgent,screen:`${screen.width}x${screen.height}@${window.devicePixelRatio||1}`,viewport:`${window.innerWidth}x${window.innerHeight}`,standalone,lang:navigator.language||''};
}
async function rptSend(){
  const d=rptDraft,u=Cloud.user;if(!d||Rpt.sending)return;
  if(!u||!Cloud.fs){toast('登入後才能回報問題');return}
  const ta=document.getElementById('rtext'),text=(ta&&ta.value||'').trim();
  if(!text){toast('請填寫內容');if(ta)ta.focus();return}
  if(d.busy){toast('圖片還在處理中，請稍候');return}
  if(!navigator.onLine){toast('需要網路連線才能送出');return}
  const ts=firebase.firestore.FieldValue.serverTimestamp();
  const doc={uid:u.uid,name:u.displayName||'',email:u.email||'',type:d.type,area:document.getElementById('rarea').value||'',text,
    imageCount:d.imgs.length,appVersion:APP_VERSION,status:'new',createdAt:ts,updatedAt:ts,statusChangedAt:ts};
  if(document.getElementById('rdiag').checked){doc.device=deviceInfo();doc.diag=errLog()}
  const ref=Cloud.fs.collection('reports').doc(),b=Cloud.fs.batch();
  b.set(ref,doc);d.imgs.forEach((x,i)=>b.set(ref.collection('images').doc(String(i)),{data:x}));
  const btn=document.getElementById('rsend');
  Rpt.sending=true;if(btn){btn.disabled=true;btn.textContent='送出中…'}
  try{
    await b.commit();
    Rpt.imgs[ref.id]=d.imgs.slice();
    if(d===rptDraft)closeSheet();
    toast('已送出，謝謝你的回報');
    const keys=setOpenKeys();if(!keys.includes('about'))setOpenSave(keys.concat(['about']));
    if(tab==='settings')render();
  }catch(e){toast('送出失敗：'+(e.code||e.message||''))}
  Rpt.sending=false;
  if(btn&&btn.isConnected){btn.disabled=false;btn.textContent='送出'}
}

/* ---------- 圖片（打開詳細內容時才讀取） ---------- */
async function rptImages(id){
  if(Rpt.imgs[id])return Rpt.imgs[id];
  const qs=await rptRef(id).collection('images').get();
  const l=qs.docs.slice().sort((a,b)=>+a.id-+b.id).map(x=>x.data().data).filter(Boolean);
  Rpt.imgs[id]=l;return l;
}
function rptImgBox(r){return r.imageCount?`<div class="rimgs" id="rimgs" data-id="${r.id}"><p class="note">讀取 ${r.imageCount} 張圖片中…</p></div>`:''}
function rptFillImages(id){
  rptImages(id).then(l=>{
    const el=document.getElementById('rimgs');if(!el||el.dataset.id!==id)return;
    el.innerHTML=l.length?l.map((b,i)=>`<img src="data:image/jpeg;base64,${b}" alt="附圖 ${i+1}">`).join(''):'<p class="note">沒有圖片</p>';
  }).catch(e=>{const el=document.getElementById('rimgs');if(el)el.innerHTML=`<p class="note">圖片讀取失敗（${esc(e.code||'')}）</p>`});
}
const rptIssueLink=n=>`<a href="${RPT_ISSUE_URL}${+n}" target="_blank" rel="noopener">#${+n}</a>`;

/* ---------- 詳細內容（我的回報、回報管理共用）：依閱讀順序 標頭 → 內容 → 圖片 → 處理進度 → 開發者回覆 ---------- */
function rptHeadHtml(r){
  return `<div class="rhead">${rptTypeTag(r.type)}${r.area?`<span class="note">${esc(r.area)}</span>`:''}${rptStTag(r.status)}<span class="note rwhen">${rptDate(r.createdAt,true)}</span></div>`;
}
const rptBodyHtml=r=>`<div class="rtext">${esc(r.text)}</div>${rptImgBox(r)}`;
// 狀態標籤已在標頭，這裡只寫說明，以及有填的 issue、修正版本
function rptProgressHtml(r){
  const st=r.status;
  const line=st==='doing'?(r.issue?`已建立 issue ${rptIssueLink(r.issue)}`:'開發者正在處理')
    :st==='done'?(r.fixedIn?`已在 ${esc(r.fixedIn)} 解決`:'已解決')
    :st==='wontfix'?'這則回報不會處理'
    :st==='read'?'開發者已經看過':'開發者還沒看過';
  let h=`<section class="rsec"><h3 class="rsec-h">處理進度</h3><div class="rprog"><div class="rprog-h">${line}</div>`;
  if(r.issue&&st!=='doing')h+=`<div class="note">Issue：${rptIssueLink(r.issue)}</div>`;
  if(r.fixedIn&&st!=='done')h+=`<div class="note">修正版本：${esc(r.fixedIn)}</div>`;
  return h+'</div></section>';
}
// 最下方，沒有回覆時不顯示
function rptReplyHtml(r){
  return r.reply?`<section class="rsec rsplit"><h3 class="rsec-h">開發者回覆</h3><div class="rtext rreply">${esc(r.reply)}</div></section>`:'';
}

/* ---------- 我的回報：詳細內容（底部表單） ---------- */
function openRptView(id){
  const r=rptById(id);if(!r)return;
  openSheet(`<div class="ntop"><b>我的回報</b><button class="nclr" data-action="close" aria-label="關閉">✕</button></div>
    ${rptHeadHtml(r)}${rptBodyHtml(r)}${rptProgressHtml(r)}${rptReplyHtml(r)}`);
  if(r.imageCount)rptFillImages(id);
  if(rptHasNews(r)){rptMarkSeen([id]);updateBell();renderIfSettings()}
}

/* ---------- 開發者：回報管理（開發者選項裡的頁面） ---------- */
const RPT_FILTERS=['all','new','read','doing','done','wontfix'];
function rptDevListHtml(){
  const cnt=k=>k==='all'?Rpt.list.length:Rpt.list.filter(r=>r.status===k).length;
  const l=Rpt.filter==='all'?Rpt.list:Rpt.list.filter(r=>r.status===Rpt.filter);
  return `${devTop(['home','開發者選項'])}<h1>回報管理</h1>
    <div class="filters rfilt">${RPT_FILTERS.map(k=>`<button class="chip" data-action="rptfilter" data-v="${k}" aria-pressed="${Rpt.filter===k}">${k==='all'?'全部':RPT_STATUS[k]} ${cnt(k)}</button>`).join('')}</div>
    ${Rpt.err?`<p class="note" style="color:var(--neg)">${esc(Rpt.err)}</p>`:!Rpt.loaded?'<p class="note">載入中…</p>'
      :l.length?`<div class="rlist">${l.map(r=>rptRow(r,`data-action="rptdev" data-id="${r.id}"`,r.status==='new',true)).join('')}</div>`:'<div class="nempty">沒有回報</div>'}`;
}
function rptDevDetailHtml(id){
  const r=rptById(id);
  if(!r)return `${devTop(['reports','回報管理'])}<div class="nempty">找不到這則回報，可能已被刪除</div>`;
  const dv=r.device,diag=r.diag;
  const tech=!dv&&!diag?'<p class="note">回報者沒有附上裝置資訊與診斷紀錄。</p>'
    :`${dv?`<div class="rinfo"><span>裝置</span><span class="rmono">${esc(dv.ua||'')}</span><span>螢幕</span><span>${esc(dv.screen||'')}（視窗 ${esc(dv.viewport||'')}）</span><span>主畫面 App</span><span>${dv.standalone?'是':'否'}</span><span>語言</span><span>${esc(dv.lang||'')}</span></div>`:''}
      <div class="note" style="margin-top:10px">錯誤紀錄（最近 ${RPT_MAX_ERR} 筆）</div>
      ${diag&&diag.length?`<ol class="rerr">${diag.slice().reverse().map(x=>`<li><span class="note">${rptDate(x.t,true)}${x.src?`・${esc(x.src)}`:''}</span><span class="rmono">${esc(x.m)}</span></li>`).join('')}</ol>`:'<p class="note">沒有錯誤紀錄</p>'}`;
  const opt=Object.entries(RPT_STATUS).map(([k,l])=>`<option value="${k}" ${k===r.status?'selected':''}>${l}</option>`).join('');
  return `${devTop(['reports','回報管理'])}<h1>${RPT_TYPES[r.type]||'其他'}回報</h1>
    ${rptHeadHtml(r)}
    <div class="rinfo rwho2"><span>回報者</span><span>${esc(r.name||'')}${r.name&&r.email?'・':''}${esc(r.email||'')}</span>
      <span>App 版本</span><span>${esc(r.appVersion||'')}</span></div>
    ${rptBodyHtml(r)}
    <details class="rtech"><summary>技術資訊</summary>${tech}</details>
    ${rptProgressHtml(r)}
    <section class="rsec rsplit"><h3 class="rsec-h">處理</h3>
    <div class="rform">
      <label class="f">狀態<select id="rst">${opt}</select></label>
      <label class="f">GitHub issue 編號${r.issue?`<span class="rlink">${rptIssueLink(r.issue)}</span>`:''}<input type="number" inputmode="numeric" min="1" step="1" id="rissue" value="${r.issue||''}" placeholder="例如 21"></label>
      <label class="f">修正版本<input type="text" id="rfix" value="${esc(r.fixedIn||'')}" placeholder="例如 v38"></label>
      <label class="f">回覆（不處理時說明原因）<textarea class="rta" id="rreply" rows="4" maxlength="3000">${esc(r.reply||'')}</textarea></label>
      <button class="primary" style="margin-top:0" data-action="rptsave" data-id="${r.id}">儲存</button>
      <button class="ghost danger" data-action="rptdel" data-id="${r.id}">刪除這則回報</button>
    </div></section>`;
}
// 打開回報；未讀的自動改為已讀
function rptOpenDev(id){
  if(!isDev())return;
  const r=rptById(id);
  devView='report:'+id;
  if(r&&r.status==='new'){
    r.status='read';
    const ts=firebase.firestore.FieldValue.serverTimestamp();
    rptRef(id).update({status:'read',updatedAt:ts,statusChangedAt:ts}).catch(e=>toast('無法標為已讀：'+(e.code||'')));
    updateBell();renderIfSettings();
  }
  devRender();
  if(r&&r.imageCount)rptFillImages(id);
}
function rptSave(id){
  const r=rptById(id);if(!r||!isDev())return;
  const v=k=>(document.getElementById(k)||{}).value||'';
  const st=RPT_STATUS[v('rst')]?v('rst'):r.status,issue=parseInt(v('rissue'),10);
  const ts=firebase.firestore.FieldValue.serverTimestamp();
  const up={status:st,issue:issue>0?issue:null,fixedIn:v('rfix').trim()||null,reply:v('rreply').trim()||null,updatedAt:ts};
  if(st!==r.status)up.statusChangedAt=ts;
  rptRef(id).update(up).catch(e=>toast('儲存失敗：'+(e.code||e.message||'')));
  Object.assign(r,{status:up.status,issue:up.issue,fixedIn:up.fixedIn,reply:up.reply});
  devRender(true);if(r.imageCount)rptFillImages(id);
  updateBell();renderIfSettings();toast('已儲存');
}
async function rptDelete(id){
  const r=rptById(id);if(!r||!isDev())return;
  if(!confirm('確定刪除這則回報？圖片會一起刪除，無法復原。'))return;
  const b=Cloud.fs.batch();
  for(let i=0;i<RPT_MAX_IMGS;i++)b.delete(rptRef(id).collection('images').doc(String(i)));
  b.delete(rptRef(id));
  b.commit().catch(e=>toast('刪除失敗：'+(e.code||'')));
  delete Rpt.imgs[id];
  devView='reports';devRender();toast('已刪除');
}
