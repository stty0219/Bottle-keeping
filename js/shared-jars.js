// 共用罐：成員、邀請、撥款紀錄同步
/* ---------- shared jars ---------- */
const FV=()=>firebase.firestore.FieldValue;
const myUid=()=>Cloud.user&&Cloud.user.uid;
const myEmail=()=>((Cloud.user&&Cloud.user.email)||'').toLowerCase();
const myName=()=>(Cloud.user&&(Cloud.user.displayName||(Cloud.user.email||'').split('@')[0]))||'我';
const jarsList=()=>{const pos=shelfPos();return Object.keys(Cloud.jars).map(id=>Object.assign({id},Cloud.jars[id])).sort((a,b)=>(pos[SJ+a.id]??1e9)-(pos[SJ+b.id]??1e9))}; // overview order
const isMirror=t=>t.kind==='contrib'||(t.id||'').startsWith('m_');
function nameOf(id){if(isSJ(id)){const j=Cloud.jars[sjId(id)];return (j?j.name:((S.jarPlan||{})[sjId(id)]||{}).name||'共用罐')+'（共用）'}const b=bucketById(id);return b?b.name:'—'}
function colorOf(id){if(isSJ(id)){const j=Cloud.jars[sjId(id)];return j?j.color:'#999'}const b=bucketById(id);return b?b.color:'#999'}
function memberName(j,uid){const m=(j.memberInfo||{})[uid];return m?(m.name||m.email):'成員'}

function stopJars(){
  if(Cloud.jarsUnsub){try{Cloud.jarsUnsub()}catch(e){}}Cloud.jarsUnsub=null;
  for(const id in Cloud.jarUnsubs){try{Cloud.jarUnsubs[id]()}catch(e){}}
  Cloud.inviteUnsubs.forEach(f=>{try{f()}catch(e){}});
  Object.assign(Cloud,{jars:{},jarTxns:{},jarLoaded:{},jarUnsubs:{},inviteUnsubs:[],invites:[],sent:[],jarsLoaded:false});
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
      if(!jp){S.jarPlan[id]={from:curMonth(),hist:[{m:curMonth(),amt:0,src:defaultSrc()}],name:Cloud.jars[id].name};changed=true}
      else if(jp.until||jp.name!==Cloud.jars[id].name){if(jp.until&&jp.until<=curMonth())jp.from=curMonth();delete jp.until;jp.name=Cloud.jars[id].name;changed=true}}
    if(!qs.metadata.fromCache){
      for(const id in S.jarPlan){if(!Cloud.jars[id]&&!S.jarPlan[id].until){S.jarPlan[id].until=shiftMonth(curMonth(),1);changed=true}}
    }
    Cloud.jarsLoaded=true;
    if(changed)persist();
    safeRender();scheduleMirror();
  },e=>{Cloud.err='共用罐同步中斷：'+(e.code||e.message);renderIfSettings()});
  watchInvites();
}
function watchJarTxns(jid){
  Cloud.jarUnsubs[jid]=Cloud.fs.collection('jars').doc(jid).collection('txns').onSnapshot(qs=>{
    Cloud.jarTxns[jid]=qs.docs.map(d=>Object.assign({},d.data(),{id:d.id,jid}));
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

/* contributions and transfers I make are mirrored into the shared jar so every member sees them */
function desiredMirrors(jid){
  const me=myUid(),nm=myName(),key=SJ+jid,jp=(S.jarPlan||{})[jid],res={};
  if(jp&&jp.from)for(let mk=jp.from,hz=horizon();mk<=hz;mk=shiftMonth(mk,1)){const c=jarContrib(jp,mk);
    if(c)res['contrib_'+me+'_'+mk]={kind:'contrib',amount:c.amt,date:mk+'-01',note:'',by:me,byName:nm,src:nameOf(c.src),srcId:c.src}}
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
  S.jarPlan=S.jarPlan||{};S.jarPlan[ref.id]={from:curMonth(),hist:[{m:curMonth(),amt:0,src:defaultSrc()}],name:data.name};
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
function sharedHtml(){
  if(!cloudOn())return `<p class="note">登入帳號後，就可以建立共用罐子，和其他人一起投錢、記帳。</p>`;
  const am=S.allocMode==='amount',me=myUid();
  const cards=jarsList().map(j=>{
    const owner=j.owner===me,jp=(S.jarPlan||{})[j.id]||{};
    const members=(j.members||[]).map(u=>`<div class="mem"><span>${esc(memberName(j,u))}${u===j.owner?'（擁有者）':''}${u===me?'・你':''}</span>${owner&&u!==me?`<button class="icon-btn" data-action="rmmember" data-jid="${j.id}" data-id="${u}" aria-label="移除成員">✕</button>`:''}</div>`).join('');
    const pend=owner?Cloud.sent.filter(x=>x.jid===j.id).map(x=>`<div class="mem"><span class="note">${esc(x.email)}・等待接受</span><button class="icon-btn" data-action="uninvite" data-id="${esc(x.id)}" aria-label="取消邀請">✕</button></div>`).join(''):'';
    const cats=(j.categories||[]).map(c=>`<div class="set-item cat-item jc">
      <button class="emo" data-action="emopick" data-jid="${j.id}" data-id="${c.id}" aria-label="更換圖示，目前是 ${esc(c.emoji)}">${esc(c.emoji)}</button>
      <input type="text" value="${esc(c.name)}" data-edit="jcname" data-jid="${j.id}" data-id="${c.id}" aria-label="分類名稱">
      <button class="icon-btn" data-action="jdelc" data-jid="${j.id}" data-id="${c.id}" aria-label="刪除分類">✕</button></div>`).join('');
    return `<div class="acct jarcard">
      <div class="jhead"><button class="swatch" style="background:${j.color}" ${owner?`data-action="colorpick" data-jid="${j.id}"`:'disabled'} aria-label="換顏色"></button>
        <input type="text" value="${esc(j.name)}" data-edit="jname" data-jid="${j.id}" ${owner?'':'disabled'} aria-label="共用罐名稱"><span class="pill">共用</span></div>
      ${(()=>{const e=jarEff(jp,curMonth())||{amt:0,src:defaultSrc()};
        return `<div class="row2" style="margin-top:0"><label class="f">資金來源<select data-edit="jsrc" data-jid="${j.id}">${S.buckets.map(b=>`<option value="${b.id}" ${b.id===e.src?'selected':''}>${esc(b.name)}</option>`).join('')}</select></label>
        <label class="f">每月撥款<input type="number" inputmode="numeric" min="0" step="100" value="${+e.amt||0}" data-edit="jamt" data-jid="${j.id}"></label></div>
        <div class="note" style="margin-top:-4px">每月從「${esc(nameOf(e.src))}」撥進共用罐，單向不退回。修改從這個月開始生效，過去的月份維持原本的金額。只有你看得到自己的設定。</div>`})()}
      <div class="sub">成員</div>${members}${pend}
      ${owner?`<div class="invrow"><input type="email" id="inv-${j.id}" placeholder="對方登入用的 Email" inputmode="email"><button class="gbtn" data-action="invite" data-jid="${j.id}">邀請</button></div>`:''}
      <div class="sub">共用分類</div>${cats}
      <button class="ghost" data-action="jaddc" data-jid="${j.id}">新增共用分類</button>
      ${owner?`<button class="ghost danger" data-action="deljar" data-jid="${j.id}">刪除共用罐</button>`:`<button class="ghost danger" data-action="leavejar" data-jid="${j.id}">退出共用</button>`}
    </div>`}).join('');
  return `${verifyHtml()}${invitesHtml()}<div style="display:grid;gap:12px">${cards}</div>
    <button class="ghost" style="margin-top:12px" data-action="newjar">新增共用罐子</button>`;
}