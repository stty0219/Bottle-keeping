// 設定頁
function settingsView(){
  const sum=targets().reduce((a,b)=>a+b.pct,0);
  const am=S.allocMode==='amount';
  const bl=S.buckets.map(b=>`<div class="set-item ${am?'amt-mode':''}">
    <button class="swatch" style="background:${b.color}" data-action="color" data-id="${b.id}" aria-label="換顏色"></button>
    <input type="text" value="${esc(b.name)}" data-edit="bname" data-id="${b.id}" aria-label="罐子名稱">
    ${am?`<input type="number" inputmode="numeric" min="0" step="100" value="${+b.amt||0}" data-edit="bamt" data-id="${b.id}" aria-label="每月金額">`
      :`<input type="number" inputmode="numeric" min="0" max="100" value="${b.pct}" data-edit="bpct" data-id="${b.id}" aria-label="分配比例">`}
    <button class="icon-btn" data-action="delb" data-id="${b.id}" aria-label="刪除罐子">✕</button>
    <label class="carry"><input type="checkbox" data-edit="bcarry" data-id="${b.id}" ${carries(b)?'checked':''} ${isRemainder(b)?'disabled':''}>${isRemainder(b)?'指定罐子，一定會結轉':'沒用完的錢結轉到下個月'}</label></div>`).join('');
  const opts=id=>S.buckets.map(b=>`<option value="${b.id}" ${b.id===id?'selected':''}>${esc(b.name)}</option>`).join('');
  const copts=id=>opts(id)+jarsList().map(j=>`<option value="${SJ+j.id}" ${SJ+j.id===id?'selected':''}>${esc(j.name)}（共用）</option>`).join('');
  const cl=S.categories.map(c=>`<div class="set-item cat-item">
    <button class="emo" data-action="emopick" data-id="${c.id}" aria-label="更換圖示，目前是 ${esc(c.emoji)}">${esc(c.emoji)}</button>
    <input type="text" value="${esc(c.name)}" data-edit="cname" data-id="${c.id}" aria-label="分類名稱">
    <select data-edit="cbucket" data-id="${c.id}" aria-label="扣款罐子">${copts(c.bucketId)}</select>
    <button class="icon-btn" data-action="delc" data-id="${c.id}" aria-label="刪除分類">✕</button></div>`).join('');
  return `<h2 style="margin-top:0">帳號與同步</h2>${accountHtml()}
  <h2>罐子與分配方式</h2>
  <div class="seg" style="grid-template-columns:1fr 1fr;margin-bottom:10px"><button data-action="allocmode" data-m="amount" aria-pressed="${am}">每月金額</button><button data-action="allocmode" data-m="pct" aria-pressed="${!am}">比例</button></div>
  <p class="note">${am?'設定每個罐子每月要放多少錢。同一個月的收入會加總後依計畫分配；修改金額會重新計算所有月份。':'每筆收入依比例分進各罐。修改比例會重新計算所有紀錄。'}「全部放入一罐」的收入不受影響。不結轉的罐子每月從計畫重新開始：月底剩下的錢會轉入「${esc(remainderBucket()?.name||'')}」，超支的部分也由它補上。</p>
  ${bl}
  ${am?`<div class="pctsum" id="plansum">每月計畫合計 <b class="num">${money(planSum())}</b></div>`
  :`<div class="pctsum ${sum===100?'':'bad'}">合計 ${sum}%${sum===100?'':'，建議調整到 100%（目前會依比例換算）'}</div>`}
  <div class="plan-extra"><label class="f">指定罐子：${am?'收入超過計畫的錢，以及':''}歸零罐子月底的剩餘或超支，都由這個罐子承接<select data-edit="remainder">${opts(remainderBucket()?.id)}</select></label>
  ${am?'<p class="note" style="margin:0">收入不足計畫時，會依各罐計畫金額等比例分配。</p>':''}</div>
  <button class="ghost" style="margin-top:12px" data-action="addb">新增罐子</button>
  <h2>共用罐子</h2>
  ${sharedHtml()}
  <h2>支出分類 → 扣款罐子</h2>
  <p class="note">選了分類，就會自動從對應的罐子扣錢。</p>
  ${cl}
  <button class="ghost" style="margin-top:12px" data-action="addc">新增分類</button>
  <h2>資料</h2>
  <p class="note">${cloudOn()?'資料已同步到雲端，這台裝置也保留一份，離線時照常可用。':'資料只存在這台裝置的瀏覽器中。換手機或清除瀏覽器資料前，請先匯出備份，或登入帳號開啟雲端同步。'}</p>
  <div class="filters">
  <button class="ghost" data-action="export">匯出備份</button>
  <button class="ghost" data-action="import">還原備份</button>
  <button class="ghost" data-action="csv">匯出 CSV</button>
  <button class="ghost danger" data-action="reset">清除所有資料</button></div>
  <input type="file" id="importFile" accept="application/json,.json" class="hidden">
  <h2>動態效果</h2>
  <label class="f">畫面的動畫與過場效果<select data-edit="motion">
    ${[['standard','標準'],['reduce','減少'],['off','關閉']].map(([v,l])=>`<option value="${v}" ${motionPref()===v?'selected':''}>${l}</option>`).join('')}</select></label>
  <p class="note">減少：保留表單滑出等必要的過場，關閉裝飾性的動畫。關閉：所有動畫都會關閉。這個設定只套用在這台裝置。</p>
  ${devOn()?'<button class="devlink" data-action="devopen"><span>🛠 開發者選項</span><span>›</span></button>':''}
  <p class="ver" data-action="vertap">Bottle-keeping ${esc(APP_VERSION)}</p>`;
}
