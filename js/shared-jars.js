// 共用罐：成員、邀請、撥款紀錄同步
/* ---------- shared jars ---------- */
const FV=()=>firebase.firestore.FieldValue;
const myUid=()=>Cloud.user&&Cloud.user.uid;
const myEmail=()=>((Cloud.user&&Cloud.user.email)||'').toLowerCase();
const myName=()=>(Cloud.user&&(Cloud.user.displayName||(Cloud.user.email||'').split('@')[0]))||'我';
const jarsList=()=>{const pos=shelfPos();return Object.keys(Cloud.jars).map(id=>Object.assign({id},Cloud.jars[id])).sort((a,b)=>(pos[SJ+a.id]??1e9)-(pos[SJ+b.id]??1e9))}; // overview order
const isMirror=t=>t.kind==='contrib'||t.kind==='cover'||(t.id||'').startsWith('m_');
function nameOf(id){if(isSJ(id)){const j=Cloud.jars[sjId(id)];return (j?j.name:((S.jarPlan||{})[sjId(id)]||{}).name||'共用罐')+'（共用）'}const b=bucketById(id);return b?b.name:'—'}
function jarName(jid){const j=Cloud.jars[jid];return j?j.name:((S.jarPlan||{})[jid]||{}).name||'共用罐'} // without the （共用） suffix
function colorOf(id){if(isSJ(id)){const j=Cloud.jars[sjId(id)];return j?j.color:'#999'}const b=bucketById(id);return b?b.color:'#999'}
function memberName(j,uid){const m=(j.memberInfo||{})[uid];return m?(m.name||m.email):'成員'}
const whoName=(u,name)=>u===myUid()?'你':(name||'成員');
// v45: a shared expense keeps only its last edit: 「你在 11/20 修改金額（原本 $2,000）、備註」
const EDIT_LABEL={amount:'金額',cat:'分類',date:'日期',note:'備註'};
function editNote(t){
  if(!t||!t.editedBy||!t.editedAt)return '';
  const d=new Date(t.editedAt),y=d.getFullYear()!==new Date().getFullYear()?d.getFullYear()+'/':'';
  const f=(t.editedFields||[]).filter(k=>EDIT_LABEL[k]).map(k=>k==='amount'&&t.prevAmount!=null?`金額（原本 ${money(t.prevAmount)}）`:EDIT_LABEL[k]);
  return `${whoName(t.editedBy,t.editedByName)}在 ${y}${d.getMonth()+1}/${d.getDate()} 修改${f.join('、')}`;
}
const byLine=t=>`${whoName(t.by,t.byName)}記錄${editNote(t)?'・'+editNote(t):''}`;

/* v45: deleting someone else's shared expense waits until the undo time is over
   (re-creating it as someone else would be refused by the rules); until then it is hidden here */
const jarPendingDel={};
function flushJarDel(k){
  const p=jarPendingDel[k];if(!p)return;
  clearTimeout(p.timer);delete jarPendingDel[k];
  jarTxnRef(p.jid,p.id).delete().catch(()=>toast('刪除失敗'));
}
function flushJarDels(){Object.keys(jarPendingDel).forEach(flushJarDel)}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushJarDels()});
window.addEventListener('pagehide',flushJarDels);

function stopJars(){
  flushJarDels();
  if(Cloud.jarsUnsub){try{Cloud.jarsUnsub()}catch(e){}}Cloud.jarsUnsub=null;
  for(const id in Cloud.jarUnsubs){try{Cloud.jarUnsubs[id]()}catch(e){}}
  Cloud.inviteUnsubs.forEach(f=>{try{f()}catch(e){}});
  Object.assign(Cloud,{jars:{},jarTxns:{},jarLoaded:{},jarUnsubs:{},inviteUnsubs:[],invites:[],sent:[],jarsLoaded:false,jarsFresh:false});
}
function startJars(){
  if(!cloudOn()||Cloud.jarsUnsub)return;
  const uidv=myUid();
  Cloud.jarsUnsub=Cloud.fs.collection('jars').where('members','array-contains',uidv).onSnapshot(qs=>{
    const seen={};
    qs.docs.forEach(d=>{
      seen[d.id]=1;
      if(!(d.metadata.hasPendingWrites&&Cloud.jars[d.id]))Cloud.jars[d.id]=d.data();
      if(!Cloud.jarUnsubs[d.id])watchJarTxns(d.id);
    });
    for(const id in Cloud.jars)if(!seen[id]){delete Cloud.jars[id];if(Cloud.jarUnsubs[id]){Cloud.jarUnsubs[id]();delete Cloud.jarUnsubs[id]}delete Cloud.jarTxns[id];delete Cloud.jarLoaded[id]}
    // keep my contribution plan in step with membership
    let changed=false;S.jarPlan=S.jarPlan||{};
    for(const id in Cloud.jars){const jp=S.jarPlan[id];
      if(!jp){S.jarPlan[id]=newJarPlan(Cloud.jars[id].name);changed=true}
      else if(jp.until||jp.name!==Cloud.jars[id].name){if(jp.until&&jp.until<=curMonth())jp.from=curMonth();delete jp.until;jp.name=Cloud.jars[id].name;changed=true}}
    if(!qs.metadata.fromCache){
      for(const id in S.jarPlan){if(!Cloud.jars[id]&&!S.jarPlan[id].until){S.jarPlan[id].until=shiftMonth(curMonth(),1);changed=true}}
    }
    Cloud.jarsLoaded=true;
    if(!qs.metadata.fromCache)Cloud.jarsFresh=true; // membership confirmed by the server, not just the offline cache
    if(migrateSharedCats())changed=true;
    if(changed)persist();
    safeRender();scheduleMirror();
  },e=>{Cloud.err='共用罐同步中斷：'+(e.code||e.message);renderIfSettings()});
  watchInvites();
}
function watchJarTxns(jid){
  Cloud.jarUnsubs[jid]=Cloud.fs.collection('jars').doc(jid).collection('txns').onSnapshot(qs=>{
    Cloud.jarTxns[jid]=qs.docs.filter(d=>!jarPendingDel[jid+'/'+d.id]).map(d=>Object.assign({},d.data(),{id:d.id,jid}));
    Cloud.jarLoaded[jid]=true;safeRender();scheduleMirror();
  },()=>{});
}
function watchInvites(){
  Cloud.inviteUnsubs.forEach(f=>{try{f()}catch(e){}});Cloud.inviteUnsubs=[];
  const col=Cloud.fs.collection('invites');
  Cloud.inviteUnsubs.push(col.where('owner','==',myUid()).onSnapshot(qs=>{Cloud.sent=qs.docs.map(d=>Object.assign({id:d.id},d.data()));renderIfSettings()},()=>{}));
  if(Cloud.user.emailVerified&&myEmail()){
    Cloud.inviteUnsubs.push(col.where('email','==',myEmail()).onSnapshot(qs=>{Cloud.invites=qs.docs.map(d=>Object.assign({id:d.id},d.data()));safeRender()},()=>{}));
  }
}

/* v34: a personal category can no longer charge a shared jar. Once the ledger and the server's jar list are in:
   still a member → the jar gets a shared category with the same name and emoji (unless it already has one), the personal one is removed;
   no longer a member → keep it, charged to the first personal jar (last in that group).
   Past shared expenses keep showing their own saved name and emoji. */
function migrateSharedCats(){
  if(!cloudOn()||!Cloud.ledgerLoaded||!Cloud.jarsFresh||!S.buckets.length)return false;
  const old=S.categories.filter(c=>isSJ(c.bucketId));if(!old.length)return false;
  const touched=new Set(),kept=[];
  for(const c of old){
    const jid=sjId(c.bucketId),j=Cloud.jars[jid];
    if(j){const cs=j.categories||(j.categories=[]);
      if(!cs.some(x=>x.name===c.name&&x.emoji===c.emoji))cs.push({id:uid(),emoji:c.emoji,name:c.name});
      touched.add(jid)}
    else{c.bucketId=S.buckets[0].id;kept.push(c)}
  }
  S.categories=S.categories.filter(c=>!old.includes(c)).concat(kept);
  touched.forEach(jid=>saveJarMeta(jid,['categories']));
  return true;
}

/* contributions and transfers I make are mirrored into the shared jar so every member sees them */
function desiredMirrors(jid){
  const me=myUid(),nm=myName(),key=SJ+jid,jp=(S.jarPlan||{})[jid],res={};
  if(jp&&jp.from)for(let mk=jp.from,hz=horizon();mk<=hz;mk=shiftMonth(mk,1)){const c=jarContrib(jp,mk);
    if(c)res['contrib_'+me+'_'+mk]={kind:'contrib',amount:c.amt,date:mk+'-01',note:'',by:me,byName:nm,src:nameOf(c.src),srcId:c.src};
    // my share of this month's new overspending, covered from the jar I chose
    const cv=jarCoverSrc(jp,mk),o=cv&&Cloud.jars[jid]?jarOver(jid,mk):null;
    if(o&&o.share>0)res['cover_'+me+'_'+mk]={kind:'cover',amount:o.share,date:mk+'-01',note:'',by:me,byName:nm,src:nameOf(cv),srcId:cv}}
  for(const t of S.txns){
    if(t.type==='transfer'&&t.to===key)res['m_'+t.id]={kind:'in',amount:t.amount,date:t.date,note:t.note||'',by:me,byName:nm,src:nameOf(t.from)};
    else if(t.type==='transfer'&&t.from===key)res['m_'+t.id]={kind:'withdraw',amount:t.amount,date:t.date,note:t.note||'',by:me,byName:nm,src:nameOf(t.to)};
    else if(t.type==='income'&&t.mode==='one'&&t.target===key)res['m_'+t.id]={kind:'in',amount:t.amount,date:t.date,note:t.note||'收入',by:me,byName:nm,src:''};
  }
  return res;
}
let mirrorTimer=null;
function scheduleMirror(){clearTimeout(mirrorTimer);mirrorTimer=setTimeout(syncMirrors,1200)}
function syncMirrors(){
  if(!cloudOn()||!Cloud.ledgerLoaded||!Cloud.jarsLoaded)return;
  const me=myUid(),sig=t=>[t.kind,t.amount,t.date,t.note||'',t.byName||'',t.src||'',t.srcId||''].join('|');
  for(const jid in Cloud.jars){
    if(!Cloud.jarLoaded[jid])continue;
    const want=desiredMirrors(jid),have={};
    (Cloud.jarTxns[jid]||[]).forEach(t=>{if(t.by===me&&isMirror(t))have[t.id]=t});
    const col=Cloud.fs.collection('jars').doc(jid).collection('txns');
    for(const id in want)if(!have[id]||sig(have[id])!==sig(want[id]))col.doc(id).set(want[id]).catch(()=>{});
    for(const id in have)if(!want[id])col.doc(id).delete().catch(()=>{});
  }
}

/* jar management */
async function createJar(){
  if(!cloudOn())return;
  const ref=Cloud.fs.collection('jars').doc();
  const used=S.buckets.map(b=>b.color).concat(jarsList().map(j=>j.color));
  const color=PALETTE.find(c=>!used.includes(c))||PALETTE[3];
  const data={name:'共用罐',color,owner:myUid(),members:[myUid()],memberInfo:{[myUid()]:{name:myName(),email:myEmail()}},
    categories:[{id:uid(),emoji:'🏠',name:'房租'},{id:uid(),emoji:'🛒',name:'家用'},{id:uid(),emoji:'🍽️',name:'聚餐'}],
    createdAt:FV().serverTimestamp(),updatedAt:FV().serverTimestamp()};
  S.jarPlan=S.jarPlan||{};S.jarPlan[ref.id]=newJarPlan(data.name);
  Cloud.jars[ref.id]=data;persist();render();
  try{await ref.set(data);toast('已建立共用罐，可以改名並邀請對方')}catch(e){toast('建立失敗：'+(e.code||''))}
}
function saveJarMeta(jid,fields){
  clearTimeout(Cloud.jarTimers[jid]);
  Cloud.jarTimers[jid]=setTimeout(()=>{
    const j=Cloud.jars[jid];if(!j)return;const up={updatedAt:FV().serverTimestamp()};
    fields.forEach(f=>up[f]=clean(j[f]));
    Cloud.fs.collection('jars').doc(jid).update(up).catch(e=>toast('共用罐沒有存到雲端：'+(e.code||'')));
  },600);
}
async function inviteTo(jid){
  const inp=document.getElementById('inv-'+jid);const email=(inp&&inp.value||'').trim().toLowerCase();
  const j=Cloud.jars[jid];if(!j)return;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast('請輸入正確的 Email');return}
  if(email===myEmail()){toast('不能邀請自己');return}
  if(Object.values(j.memberInfo||{}).some(m=>(m.email||'').toLowerCase()===email)){toast('對方已經是成員了');return}
  try{
    await Cloud.fs.collection('invites').doc(email+'_'+jid).set({jid,owner:myUid(),email,jarName:j.name,fromName:myName(),createdAt:FV().serverTimestamp()});
    toast('邀請已送出，對方登入後就會看到');
  }catch(e){toast('邀請失敗：'+(e.code||''))}
}
async function acceptInvite(iid){
  const inv=Cloud.invites.find(x=>x.id===iid);if(!inv)return;
  try{
    const b=Cloud.fs.batch();
    b.update(Cloud.fs.collection('jars').doc(inv.jid),{members:FV().arrayUnion(myUid()),['memberInfo.'+myUid()]:{name:myName(),email:myEmail()},updatedAt:FV().serverTimestamp()});
    b.delete(Cloud.fs.collection('invites').doc(iid));
    await b.commit();
    toast(`已加入「${inv.jarName}」，到設定頁可以設定每月投入多少`);
  }catch(e){toast('加入失敗：'+(e.code||''))}
}
async function declineInvite(iid){try{await Cloud.fs.collection('invites').doc(iid).delete();toast('已婉拒')}catch(e){toast('操作失敗')}}
async function cancelInvite(iid){try{await Cloud.fs.collection('invites').doc(iid).delete();toast('已取消邀請')}catch(e){toast('操作失敗')}}
async function leaveJar(jid){
  const j=Cloud.jars[jid];if(!j)return;
  if(!confirm(`確定退出「${j.name}」？\n\n退出後這個罐子會從你的畫面消失，你之前投入的錢和記的紀錄會留在罐子裡。`))return;
  try{
    await Cloud.fs.collection('jars').doc(jid).update({members:FV().arrayRemove(myUid()),['memberInfo.'+myUid()]:FV().delete(),updatedAt:FV().serverTimestamp()});
    if(S.jarPlan[jid])S.jarPlan[jid].until=shiftMonth(curMonth(),1);
    persist();toast('已退出共用');
  }catch(e){toast('退出失敗：'+(e.code||''))}
}
async function removeMember(jid,u){
  const j=Cloud.jars[jid];if(!j)return;
  if(!confirm(`確定把「${memberName(j,u)}」移出「${j.name}」？對方記的紀錄會保留。`))return;
  try{await Cloud.fs.collection('jars').doc(jid).update({members:FV().arrayRemove(u),['memberInfo.'+u]:FV().delete(),updatedAt:FV().serverTimestamp()});toast('已移除成員')}
  catch(e){toast('移除失敗：'+(e.code||''))}
}
async function deleteJar(jid){
  const j=Cloud.jars[jid];if(!j)return;
  if(!confirm(`確定刪除「${j.name}」？\n\n罐子和裡面所有人的紀錄都會刪除，無法復原。罐子裡如果還有錢，建議先轉回各自的罐子。`))return;
  try{
    const ref=Cloud.fs.collection('jars').doc(jid);
    const qs=await ref.collection('txns').get();
    for(let i=0;i<qs.docs.length;i+=400){const b=Cloud.fs.batch();qs.docs.slice(i,i+400).forEach(d=>b.delete(d.ref));await b.commit()}
    for(const inv of Cloud.sent.filter(x=>x.jid===jid))await Cloud.fs.collection('invites').doc(inv.id).delete();
    await ref.delete();
    if(S.jarPlan[jid])S.jarPlan[jid].until=shiftMonth(curMonth(),1);
    persist();toast('已刪除共用罐');
  }catch(e){toast('刪除失敗：'+(e.code||''))}
}
async function sendVerify(){try{await Cloud.user.sendEmailVerification();toast('驗證信已寄出，請到信箱點連結')}catch(e){toast('寄送失敗：'+(e.code||''))}}
async function checkVerified(){
  try{await Cloud.user.reload();Cloud.user=Cloud.auth.currentUser;await Cloud.user.getIdToken(true)}catch(e){}
  if(Cloud.user.emailVerified){toast('Email 已驗證');watchInvites()}else toast('還沒有驗證成功，請到信箱點驗證連結');
  renderIfSettings();
}

function invitesHtml(){
  return Cloud.invites.map(inv=>`<div class="acct invite"><div><b>${esc(inv.fromName||'有人')}</b> 邀請你共用「<b>${esc(inv.jarName||'共用罐')}</b>」罐子</div>
    <div class="btns"><button class="gbtn" data-action="accept" data-id="${esc(inv.id)}">接受</button><button class="ghost" data-action="decline" data-id="${esc(inv.id)}">婉拒</button></div></div>`).join('');
}
function verifyHtml(){
  const u=Cloud.user;if(!u||u.emailVerified)return '';
  return `<div class="acct"><div class="note">你的 Email 還沒驗證。為了安全，要先驗證 Email，才能接受別人的共用邀請。</div>
    <div class="btns"><button class="ghost" data-action="verify">寄送驗證信</button><button class="ghost" data-action="verified">我已完成驗證</button></div></div>`;
}
// 「罐子」分區的共用罐卡片：只放和錢有關的設定（所屬罐子、每月撥款），成員與邀請在「帳號與共用」
function sharedHtml(){
  if(!cloudOn())return `<p class="note">登入帳號後，就可以建立共用罐子，和其他人一起投錢、記帳。</p>`;
  const me=myUid();
  const cards=jarsList().map(j=>{
    const owner=j.owner===me,jp=(S.jarPlan||{})[j.id]||{}; // v45: every member can change the name and color
    const e=jarEff(jp,curMonth())||{amt:0,src:defaultSrc()},src=bucketById(e.src)?e.src:defaultSrc(),sname=esc(nameOf(src));
    const n=(j.members||[]).length;
    return `<div class="jarcard">
      <div class="jhead"><button class="swatch" style="background:${j.color}" data-action="colorpick" data-jid="${j.id}" aria-label="換顏色"></button>
        <input type="text" value="${esc(j.name)}" data-edit="jname" data-jid="${j.id}" aria-label="共用罐名稱">
        <span class="jtag"><span class="pill">共用</span><span class="jn">${n} 人</span></span></div>
      <label class="jline"><span>這個共用罐屬於我的</span><select data-edit="jsrc" data-jid="${j.id}" aria-label="這個共用罐屬於我的哪個罐子">${S.buckets.map(b=>`<option value="${b.id}" ${b.id===src?'selected':''}>${esc(b.name)}</option>`).join('')}</select></label>
      <label class="jline"><span>每月撥款</span><input type="number" inputmode="numeric" min="0" step="100" value="${+e.amt||0}" data-edit="jamt" data-jid="${j.id}" aria-label="每月撥款"></label>
      <p class="note jnote">每月從「${sname}」撥進共用罐，單向不退回；共用罐超支時，你的份額也從「${sname}」扣。這兩筆都算「${sname}」的支出。修改從這個月開始生效，過去的月份維持原本的設定。只有你看得到自己的設定。</p>
      <div class="jdanger">${owner?`<button class="tbtn danger" data-action="deljar" data-jid="${j.id}">刪除共用罐</button>`:`<button class="tbtn danger" data-action="leavejar" data-jid="${j.id}">退出共用</button>`}</div>
    </div>`}).join('');
  return `<div class="jarcards">${cards}</div>
    <button class="ghost" style="margin-top:12px" data-action="newjar">新增共用罐子</button>`;
}
// 「帳號與共用」分區：收到的邀請、各共用罐的成員與邀請（每個共用罐一組，可以收合；收合狀態記在這台裝置）
const MEM_CLOSED_KEY='fenguan-memclosed';
function memClosed(){try{const v=JSON.parse(localStorage.getItem(MEM_CLOSED_KEY));if(Array.isArray(v))return v}catch(e){}return []} // default: all open
function toggleMemGroup(k){
  const closed=new Set(memClosed()),on=closed.has(k);
  on?closed.delete(k):closed.add(k);
  try{localStorage.setItem(MEM_CLOSED_KEY,JSON.stringify([...closed]))}catch(e){}
  const body=document.getElementById('mg-'+k),h=body&&body.previousElementSibling;
  if(h)h.setAttribute('aria-expanded',on);
  if(body)body.hidden=!on;
}
function membersHtml(){
  if(!cloudOn())return '';
  const me=myUid(),closed=new Set(memClosed()),jars=jarsList();
  const inv=Cloud.invites.length?`<h3 class="sec-sub">收到的邀請</h3>${invitesHtml()}`:'';
  const groups=jars.map(j=>{
    const owner=j.owner===me,on=!closed.has(j.id),n=(j.members||[]).length;
    const members=(j.members||[]).map(u=>`<div class="mem"><span>${esc(memberName(j,u))}${u===j.owner?'（擁有者）':''}${u===me?'・你':''}</span>${owner&&u!==me?`<button class="icon-btn" data-action="rmmember" data-jid="${j.id}" data-id="${u}" aria-label="移除成員">✕</button>`:''}</div>`).join('');
    const pend=owner?Cloud.sent.filter(x=>x.jid===j.id).map(x=>`<div class="mem"><span class="note">${esc(x.email)}・等待接受</span><button class="icon-btn" data-action="uninvite" data-id="${esc(x.id)}" aria-label="取消邀請">✕</button></div>`).join(''):'';
    return `<div class="cgrp">
      <button class="cgrp-h" data-action="memgrp" data-k="${j.id}" aria-expanded="${on}" aria-controls="mg-${j.id}">
        <span class="dot" style="background:${j.color}"></span><span class="cgrp-t">${esc(j.name)}<span class="cgrp-n">・${n} 人</span></span><span class="chev" aria-hidden="true">›</span></button>
      <div class="cgrp-b" id="mg-${j.id}" ${on?'':'hidden'}>${members}${pend}
        ${owner?`<div class="invrow"><input type="email" id="inv-${j.id}" placeholder="對方登入用的 Email" inputmode="email"><button class="gbtn" data-action="invite" data-jid="${j.id}">邀請</button></div>`:'<p class="note" style="margin:4px 0 0">只有擁有者可以邀請或移除成員。</p>'}</div></div>`}).join('');
  return `${inv}<h3 class="sec-sub">共用成員</h3>${jars.length?`<div class="cgrps">${groups}</div>`:'<p class="note" style="margin:0">還沒有共用罐。到「罐子」分區新增共用罐後，可以在這裡邀請成員。</p>'}`;
}