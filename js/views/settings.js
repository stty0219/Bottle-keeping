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

function settingsView(){
  const open=new Set(setOpenKeys()),sec=(k,t,s,b,h)=>setSection(k,t,s,b,h,open.has(k));
  const rname=esc(remainderBucket()?.name||'');
  const bl=S.buckets.map(b=>`<div class="set-item amt-mode brow" data-id="${b.id}">
    <span class="dh" data-drag="bucket" aria-label="按住拖拉調整順序" title="按住拖拉調整順序">≡</span>
    <button class="swatch" style="background:${b.color}" data-action="colorpick" data-id="${b.id}" aria-label="換顏色"></button>
    <input type="text" value="${esc(b.name)}" data-edit="bname" data-id="${b.id}" aria-label="罐子名稱">
    <input type="number" inputmode="numeric" min="0" step="100" value="${+b.amt||0}" data-edit="bamt" data-id="${b.id}" aria-label="每月金額">
    <button class="icon-btn" data-action="delb" data-id="${b.id}" aria-label="刪除罐子">✕</button>
    <label class="carry"><input type="checkbox" data-edit="bcarry" data-id="${b.id}" ${carries(b)?'checked':''} ${isRemainder(b)?'disabled':''}>${isRemainder(b)?'指定罐子，一定會結轉':'沒用完的錢結轉到下個月'}</label></div>`).join('');
  const opts=id=>S.buckets.map(b=>`<option value="${b.id}" ${b.id===id?'selected':''}>${esc(b.name)}</option>`).join('');
  const copts=id=>opts(id)+jarsList().map(j=>`<option value="${SJ+j.id}" ${SJ+j.id===id?'selected':''}>${esc(j.name)}（共用）</option>`).join('');
  const cl=S.categories.map(c=>`<div class="set-item cat-item">
    <button class="emo" data-action="emopick" data-id="${c.id}" aria-label="更換圖示，目前是 ${esc(c.emoji)}">${esc(c.emoji)}</button>
    <input type="text" value="${esc(c.name)}" data-edit="cname" data-id="${c.id}" aria-label="分類名稱">
    <select data-edit="cbucket" data-id="${c.id}" aria-label="扣款罐子">${copts(c.bucketId)}</select>
    <button class="icon-btn" data-action="delc" data-id="${c.id}" aria-label="刪除分類">✕</button></div>`).join('');

  // summaries and alerts (alerts show even when the section is collapsed)
  const u=Cloud.user;
  const acctSum=!cloudConfigured()?'雲端未設定':u?(u.email||u.displayName||'已登入'):'尚未登入';
  const acctBadge=u&&!u.emailVerified?'Email 未驗證':'';
  const nj=jarsList().length;
  const jarsSum=`${S.buckets.length} 個罐子${nj?`、${nj} 個共用罐`:''}`;
  const ni=(Cloud.invites||[]).length;
  const jarsBadge=ni?`${ni} 個邀請`:'';
  const motionLabel={standard:'標準',reduce:'減少',off:'關閉'};

  return sec('account','帳號與同步',acctSum,acctBadge,`${accountHtml()}${verifyHtml()}`)
  +sec('jars','罐子',jarsSum,jarsBadge,`<h3 class="sec-sub">個人罐子</h3>
  <p class="note">設定每個罐子每月要放多少錢。同一個月的收入會加總後依計畫分配；修改金額會重新計算所有月份。「全部放入一罐」的收入不受影響。按住左側的 ≡ 可以拖拉調整順序。</p>
  <div id="bucketList">${bl}</div>
  <div class="pctsum" id="plansum">每月計畫合計 <b class="num">${money(planSum())}</b></div>
  ${planSum()?'':`<p class="note" style="color:var(--neg);margin:6px 0 0">還沒有設定每月金額，收入會全部放入「${rname}」。</p>`}
  <button class="ghost" style="margin-top:12px" data-action="addb">新增罐子</button>
  <h3 class="sec-sub">共用罐</h3>
  ${sharedHtml()}`)
  +sec('alloc','分配與結算',remainderBucket()?.name||'','',`<div class="plan-extra" style="margin-top:0"><label class="f">指定罐子：收入超過計畫的錢，以及歸零罐子月底的剩餘或超支，都由這個罐子承接<select data-edit="remainder">${opts(remainderBucket()?.id)}</select></label>
  <p class="note" style="margin:0">不結轉的罐子每月從計畫重新開始：月底剩下的錢會轉入「${rname}」，超支的部分也由它補上。</p>
  <p class="note" style="margin:0">收入不足計畫時，會依各罐計畫金額等比例分配。</p></div>`)
  +sec('cats','支出分類',`${S.categories.length} 個`,'',`<p class="note" style="margin-top:0">選了分類，就會自動從對應的罐子扣錢。</p>
  ${cl}
  <button class="ghost" style="margin-top:12px" data-action="addc">新增分類</button>`)
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
  +`${devOn()?'<button class="devlink" data-action="devopen"><span>🛠 開發者選項</span><span>›</span></button>':''}
  <p class="ver" data-action="vertap">Bottle-keeping ${esc(APP_VERSION)}</p>`;
}
