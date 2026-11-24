// 設定頁
/* ---------- collapsible sections: open state is per device ---------- */
const SET_OPEN_KEY='fenguan-setopen';
function setOpenKeys(){
  try{const v=JSON.parse(localStorage.getItem(SET_OPEN_KEY));if(Array.isArray(v))return v}catch(e){}
  return ['jars']; // first visit: only 罐子 is open
}
function setOpenSave(keys){try{localStorage.setItem(SET_OPEN_KEY,JSON.stringify(keys))}catch(e){}}
// toggle one section in place (no render, so scroll position and the arrow animation stay intact)
function toggleSection(k){
  const open=new Set(setOpenKeys()),on=!open.has(k);
  on?open.add(k):open.delete(k);setOpenSave([...open]);
  const h=document.querySelector(`.sec-h[data-k="${k}"]`),body=document.getElementById('sec-'+k);
  if(h)h.setAttribute('aria-expanded',on);
  if(body)body.hidden=!on;
}
function setSection(k,title,sum,badge,body,open){
  return `<section class="sec">
  <button class="sec-h" data-action="setsec" data-k="${k}" aria-expanded="${open}" aria-controls="sec-${k}">
    <span class="sec-t">${title}</span>
    <span class="sec-r">${badge?`<span class="sec-badge">${esc(badge)}</span>`:''}${sum?`<span class="sec-sum">${esc(sum)}</span>`:''}<span class="chev" aria-hidden="true">›</span></span>
  </button>
  <div class="sec-b" id="sec-${k}" ${open?'':'hidden'}>${body}</div></section>`;
}

/* expense categories: one collapsible group per jar, in overview order; open groups are per device */
const CAT_OPEN_KEY='fenguan-catopen';
function catOpenKeys(){try{const v=JSON.parse(localStorage.getItem(CAT_OPEN_KEY));if(Array.isArray(v))return v}catch(e){}return []} // default: all collapsed
function toggleCatGroup(k){
  const open=new Set(catOpenKeys()),on=!open.has(k);
  on?open.add(k):open.delete(k);
  try{localStorage.setItem(CAT_OPEN_KEY,JSON.stringify([...open]))}catch(e){}
  const body=document.getElementById('cg-'+k),h=body&&body.previousElementSibling;
  if(h)h.setAttribute('aria-expanded',on);
  if(body)body.hidden=!on;
}
function catGroupsHtml(){
  const open=new Set(catOpenKeys());let n=0;
  const bopts=id=>S.buckets.map(b=>`<option value="${b.id}" ${b.id===id?'selected':''}>${esc(b.name)}</option>`).join('');
  const emo=(c,jid)=>`<button class="emo" data-action="emopick" ${jid?`data-jid="${jid}" `:''}data-id="${c.id}" aria-label="更換圖示，目前是 ${esc(c.emoji)}">${esc(c.emoji)}</button>`;
  const dh='<span class="dh" data-drag="cat" aria-label="按住拖拉調整順序" title="按住拖拉調整順序">≡</span>';
  const group=(k,name,color,shared,rows,count,lead,foot)=>{n+=count;const on=open.has(k);
    return `<div class="cgrp">
    <button class="cgrp-h" data-action="catgrp" data-k="${esc(k)}" aria-expanded="${on}" aria-controls="cg-${esc(k)}">
      <span class="dot" style="background:${color}"></span><span class="cgrp-t">${esc(name)}<span class="cgrp-n">・${count} 個</span></span>${shared?'<span class="pill">共用</span>':''}<span class="chev" aria-hidden="true">›</span></button>
    <div class="cgrp-b" id="cg-${esc(k)}" ${on?'':'hidden'}>${lead}<div class="cgrp-list" data-grp="${esc(k)}">${rows}</div>${foot}</div></div>`};
  const html=shelfIds().map(id=>{
    if(isSJ(id)){
      const jid=sjId(id),j=Cloud.jars[jid];if(!j)return '';
      const cs=j.categories||[];
      const rows=cs.map(c=>`<div class="set-item cat-item crow jc" data-id="${c.id}">${dh}${emo(c,jid)}
        <input type="text" value="${esc(c.name)}" data-edit="jcname" data-jid="${jid}" data-id="${c.id}" aria-label="分類名稱">
        <button class="icon-btn" data-action="jdelc" data-jid="${jid}" data-id="${c.id}" aria-label="刪除分類">✕</button></div>`).join('');
      return group(id,j.name,j.color,true,rows,cs.length,'<p class="note cgrp-lead">共用分類由所有成員共用，修改會影響其他成員。</p>',
        `<button class="ghost cgrp-add" data-action="jaddc" data-jid="${jid}">新增分類</button>`);
    }
    const b=bucketById(id);if(!b)return '';
    const cs=S.categories.filter(c=>c.bucketId===b.id);
    const rows=cs.map(c=>`<div class="set-item cat-item crow" data-id="${c.id}">${dh}${emo(c)}
      <input type="text" value="${esc(c.name)}" data-edit="cname" data-id="${c.id}" aria-label="分類名稱">
      <select data-edit="cbucket" data-id="${c.id}" aria-label="扣款罐子">${bopts(c.bucketId)}</select>
      <button class="icon-btn" data-action="delc" data-id="${c.id}" aria-label="刪除分類">✕</button></div>`).join('');
    return group(b.id,b.name,b.color,false,rows,cs.length,'',`<button class="ghost cgrp-add" data-action="addc" data-b="${b.id}">新增分類</button>`);
  }).join('');
  return {html,n};
}

function settingsView(){
  const open=new Set(setOpenKeys()),sec=(k,t,s,b,h)=>setSection(k,t,s,b,h,open.has(k));
  const ex=excessBucket(),sw=sweepBucket(),exName=esc(ex?.name||'');
  const pinWhy=b=>ex&&sw&&ex.id===b.id&&sw.id===b.id?'收入超過計畫的錢和歸零罐子的月底結算都放在這裡'
    :ex&&ex.id===b.id?'收入超過計畫的錢放在這裡':'歸零罐子的月底結算放在這裡';
  // v43: type (spending / savings); a spending jar can keep what is left for next month
  const kindRow=b=>{const save=isSave(b);
    return `<label class="carry kind">類型<select data-edit="bkind" data-id="${b.id}" aria-label="${esc(b.name)}的類型">
      <option value="spend" ${save?'':'selected'}>花費</option><option value="save" ${save?'selected':''}>儲蓄</option></select>${save&&isPinned(b)?`<span class="kind-why">${pinWhy(b)}</span>`:''}</label>
    ${save?`<label class="carry goal">目標金額<input type="number" inputmode="numeric" min="0" step="1000" placeholder="選填" value="${+b.goal>0?+b.goal:''}" data-edit="bgoal" data-id="${b.id}" aria-label="${esc(b.name)}的目標金額（選填）"></label>`
      :`<label class="carry"><input type="checkbox" data-edit="bcarry" data-id="${b.id}" ${b.carry===true?'checked':''}>沒花完的錢留到下個月</label>`}`};
  const coverOpts=b=>`<option value="">不墊付</option>`+S.buckets.filter(o=>o.id!==b.id).map(o=>`<option value="${o.id}" ${o.id===b.coverBy?'selected':''}>${esc(o.name)}</option>`).join('');
  const bl=S.buckets.map(b=>`<div class="set-item amt-mode brow" data-id="${b.id}">
    <span class="dh" data-drag="bucket" aria-label="按住拖拉調整順序" title="按住拖拉調整順序">≡</span>
    <button class="swatch" style="background:${b.color}" data-action="colorpick" data-id="${b.id}" aria-label="換顏色"></button>
    <input type="text" value="${esc(b.name)}" data-edit="bname" data-id="${b.id}" aria-label="罐子名稱">
    <input type="number" inputmode="numeric" min="0" step="100" value="${+b.amt||0}" data-edit="bamt" data-id="${b.id}" aria-label="每月金額">
    <button class="icon-btn" data-action="delb" data-id="${b.id}" aria-label="刪除罐子">✕</button>
    ${kindRow(b)}
    <label class="carry cover">超支時從<select data-edit="bcover" data-id="${b.id}" aria-label="${esc(b.name)}超支時由哪個罐子墊付">${coverOpts(b)}</select>扣</label></div>`).join('');
  const carryOpts=id=>S.buckets.filter(isSave).map(b=>`<option value="${b.id}" ${b.id===id?'selected':''}>${esc(b.name)}</option>`).join('');
  const allocSum=!ex?'':ex.id===sw.id?ex.name:`多的→${ex.name}・結算→${sw.name}`;
  const cats=catGroupsHtml();

  // summaries and alerts (alerts show even when the section is collapsed)
  const u=Cloud.user;
  const acctSum=!cloudConfigured()?'雲端未設定':u?(u.email||u.displayName||'已登入'):'尚未登入';
  const ni=(Cloud.invites||[]).length;
  const acctBadge=u&&!u.emailVerified?'Email 未驗證':ni?`${ni} 個邀請`:'';
  const nj=jarsList().length;
  const jarsSum=`${S.buckets.length} 個罐子${nj?`、${nj} 個共用罐`:''}`;
  const motionLabel={standard:'標準',reduce:'減少',off:'關閉'};

  return sec('account','帳號與共用',acctSum,acctBadge,`${accountHtml()}${verifyHtml()}${membersHtml()}`)
  +sec('jars','罐子',jarsSum,S.kindNote?'請檢查類型':'',`${S.kindNote?`<div class="kind-note" role="status"><b>罐子改為「花費型」與「儲蓄型」</b>
    <p>原本每月歸零的罐子改為花費型，原本會結轉的罐子改為儲蓄型，金額都沒有變。請檢查每個罐子的類型是否符合用途。</p>
    <button class="ghost" data-action="kindok">知道了</button></div>`:''}<h3 class="sec-sub">個人罐子</h3>
  <p class="note">設定每個罐子每月要放多少錢。同一個月的收入會加總後依計畫分配；修改金額會重新計算所有月份。「全部放入一罐」的收入不受影響。按住左側的 ≡ 可以拖拉調整順序。</p>
  <p class="note">花費型：用來花的錢，月底歸零，也可以選擇把沒花完的錢留到下個月。儲蓄型：用來存的錢，一定會累積到下個月，顯示這個月淨存了多少。</p>
  <div id="bucketList">${bl}</div>
  <div class="pctsum" id="plansum">每月計畫合計 <b class="num">${money(planSum())}</b></div>
  ${planSum()?'':`<p class="note" style="color:var(--neg);margin:6px 0 0">還沒有設定每月金額，收入會全部放入「${exName}」。</p>`}
  <button class="ghost" style="margin-top:12px" data-action="addb">新增罐子</button>
  <h3 class="sec-sub">共用罐</h3>
  ${sharedHtml()}`)
  +sec('alloc','分配與結算',allocSum,'',`<div class="plan-extra" style="margin-top:0"><label class="f">收入超過計畫的錢放入<select data-edit="excessTo">${carryOpts(ex?.id)}</select></label>
  <label class="f">歸零罐子月底的剩餘或不足放入<select data-edit="sweepTo">${carryOpts(sw?.id)}</select></label>
  <p class="note" style="margin:0">這兩個選單只列出儲蓄型罐子。月底歸零的花費型罐子每月從計畫重新開始，月底剩下的錢（或不足的部分）會結算進「${esc(sw?.name||'')}」。</p>
  <p class="note" style="margin:0">罐子超支時由誰墊付，在「罐子」分區的每個罐子各自設定。</p>
  <p class="note" style="margin:0">收入不足計畫時，會依各罐計畫金額等比例分配。</p></div>`)
  +sec('cats','支出分類',`${cats.n} 個`,'',`<p class="note" style="margin-top:0">選了分類，就會自動從對應的罐子扣錢。按住左側的 ≡ 可以在同一個罐子內拖拉調整順序。</p>
  <div class="cgrps">${cats.html}</div>`)
  +sec('data','資料',cloudOn()?'已同步':'只存在這台裝置','',`<p class="note" style="margin-top:0">${cloudOn()?'資料已同步到雲端，這台裝置也保留一份，離線時照常可用。':'資料只存在這台裝置的瀏覽器中。換手機或清除瀏覽器資料前，請先匯出備份，或登入帳號開啟雲端同步。'}</p>
  <div class="filters">
  <button class="ghost" data-action="export">匯出備份</button>
  <button class="ghost" data-action="import">還原備份</button>
  <button class="ghost" data-action="csv">匯出 CSV</button>
  <button class="ghost danger" data-action="reset">清除所有資料</button></div>
  <input type="file" id="importFile" accept="application/json,.json" class="hidden">`)
  +sec('display','顯示',motionLabel[motionPref()]||'','',`<label class="f">動態效果：畫面的動畫與過場效果<select data-edit="motion">
    ${[['standard','標準'],['reduce','減少'],['off','關閉']].map(([v,l])=>`<option value="${v}" ${motionPref()===v?'selected':''}>${l}</option>`).join('')}</select></label>
  <p class="note">減少：保留表單滑出等必要的過場，關閉裝飾性的動畫。關閉：所有動畫都會關閉。這個設定只套用在這台裝置。</p>`)
  +sec('about','關於與回報',aboutSum(),aboutBadge(),aboutHtml())
  +`${devOn()?`<button class="devlink" data-action="devopen"><span>🛠 開發者選項${rptUnread()?'<span class="rdot" aria-label="有新回報"></span>':''}</span><span>›</span></button>`:''}
  <p class="ver" data-action="vertap">Bottle-keeping ${esc(APP_VERSION)}</p>`;
}
