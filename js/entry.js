// 記一筆／編輯：計算機鍵盤、分類列、存檔
function openAdd(type){
  draft={type:type||'expense',amount:'',expr:'',catId:null,date:today(),note:'',mode:'pct',target:S.buckets[0]?.id,from:S.buckets[0]?.id,to:S.buckets[1]?.id||S.buckets[0]?.id};
  openSheet(addHtml());
}
function focusAmount(){}
/* calculator: expression like "120+85×2", evaluated with × ÷ before + − */
const OPS='+−×÷';
const hasOp=x=>/[+−×÷]/.test(x.replace(/^−/,''));
function evalExpr(x){
  if(!x)return null;
  const toks=x.match(/\d+\.?\d*|\.\d+|[+−×÷]/g);if(!toks||toks.join('')!==x)return null;
  if(OPS.includes(toks[toks.length-1]))return null;
  const nums=[],ops=[];
  const ap=()=>{const b=nums.pop(),a=nums.pop(),o=ops.pop();nums.push(o==='+'?a+b:o==='−'?a-b:o==='×'?a*b:(b===0?NaN:a/b))};
  const pr=o=>o==='×'||o==='÷'?2:1;
  for(const t of toks){
    if(OPS.includes(t)){while(ops.length&&pr(ops[ops.length-1])>=pr(t))ap();ops.push(t)}
    else nums.push(parseFloat(t));
  }
  while(ops.length)ap();
  const r=nums[0];return Number.isFinite(r)?r:null;
}
const fmtNum=s=>{const [i,dec]=s.split('.');return (i?Number(i).toLocaleString('zh-TW'):'0')+(dec!==undefined?'.'+dec:'')};
const fmtExpr=x=>x.replace(/\d+\.?\d*|\.\d+/g,m=>fmtNum(m)).replace(/([+−×÷])/g,' $1 ');
function amountInner(){
  const x=draft.expr||'',r=evalExpr(x);
  const show=hasOp(x)?fmtExpr(x):'';
  let res;
  if(!x)res='<div class="res num empty">$0</div>';
  else if(r===null)res=`<div class="res num">${hasOp(x)?'—':'$'+fmtNum(x)}</div>`;
  else res=`<div class="res num">${Math.round(r)!==r?'<small>≈</small>':''}${r<0?'−':''}$${Math.abs(Math.round(r)).toLocaleString('zh-TW')}</div>`;
  return `<div class="expr num">${esc(show)}</div>${res}`;
}
function syncAmount(){
  const r=evalExpr(draft.expr||'');
  draft.amount=r!==null&&Math.round(r)>0?String(Math.round(r)):'';
  const a=document.getElementById('amtBox');if(a)a.innerHTML=amountInner();
  updateHint();
}
function updateKeypad(){
  const g=document.getElementById('kpGo');if(!g||!draft)return;
  const x=draft.expr||'';
  if(hasOp(x)){g.textContent='＝';g.disabled=evalExpr(x)===null}
  else{g.textContent='✓ 記下';g.disabled=!draft.ok}
}
function keypadHtml(){
  const k=(v,l,c)=>`<button type="button" class="${c||''}" data-action="kp" data-k="${v}" aria-label="${l||v}">${l||v}</button>`;
  return `<div class="keypad" id="kp">${k('AC','AC','fn')}${k('÷','÷','op')}${k('×','×','op')}${k('del','⌫','fn')}
    ${k('7')}${k('8')}${k('9')}${k('−','−','op')}
    ${k('4')}${k('5')}${k('6')}${k('+','+','op')}
    ${k('1')}${k('2')}${k('3')}<button type="button" class="go" id="kpGo" data-action="kp" data-k="go">✓ 記下</button>
    ${k('00')}${k('0')}${k('.')}</div>`;
}
function pressKey(k){
  if(!draft)return;
  let x=draft.expr||'';
  const cur=(x.match(/(\d+\.?\d*|\.\d+)$/)||[''])[0];
  const last=x.slice(-1);
  if(k==='AC')x='';
  else if(k==='del')x=x.slice(0,-1);
  else if(k==='go'){
    if(hasOp(x)){const r=evalExpr(x);if(r===null)return;if(r<=0){toast('金額要大於 0');return}x=String(Math.round(r*100)/100)}
    else{if(draft.ok)saveDraft();return}
  }
  else if(OPS.includes(k)){
    if(!x)return;
    if(last==='.')x=x.slice(0,-1);
    if(OPS.includes(x.slice(-1)))x=x.slice(0,-1)+k;else x+=k;
  }
  else if(k==='.'){if(cur.includes('.'))return;x+=cur?'.':'0.'}
  else{ // digits and 00
    if(x.replace(/[^\d]/g,'').length>=15)return;
    if(cur==='0')x=x.slice(0,-1)+(k==='00'?'0':k);
    else if(!cur&&k==='00')x+='0';
    else x+=k;
  }
  draft.expr=x;syncAmount();
}
// category strip: most used first, plus whatever is selected, then 「全部」
function catOptions(){
  const list=S.categories.filter(c=>!isSJ(c.bucketId)||Cloud.jars[sjId(c.bucketId)]).map(c=>({key:c.id,emoji:c.emoji,name:c.name,color:colorOf(c.bucketId),group:isSJ(c.bucketId)?c.bucketId:c.bucketId}));
  for(const j of jarsList())for(const c of (j.categories||[]))list.push({key:'jc:'+j.id+':'+c.id,emoji:c.emoji,name:c.name,color:j.color,group:SJ+j.id});
  return list;
}
function topCats(n){
  const cnt={},me=myUid();
  for(const t of S.txns)if(t.type==='expense'&&t.catId)cnt[t.catId]=(cnt[t.catId]||0)+1;
  for(const j of jarsList())for(const t of (Cloud.jarTxns[j.id]||[]))if(t.kind==='expense'&&t.by===me&&t.catKey)cnt[t.catKey]=(cnt[t.catKey]||0)+1;
  const all=catOptions();
  const top=all.map((c,i)=>({c,i,n:cnt[c.key]||0})).sort((a,b)=>b.n-a.n||a.i-b.i).slice(0,n).map(x=>x.c);
  const sel=draft.catId&&all.find(c=>c.key===draft.catId);
  if(sel&&!top.some(c=>c.key===sel.key)){top.pop();top.unshift(sel)}
  return top;
}
function catPickerHtml(){
  const opts=catOptions(),groups=[];
  for(const b of S.buckets){const cs=opts.filter(c=>c.group===b.id);if(cs.length)groups.push([b.name,cs])}
  for(const j of jarsList()){const cs=opts.filter(c=>c.group===SJ+j.id);if(cs.length)groups.push([j.name+'（共用）',cs])}
  return `<div class="pkhead"><button data-action="catback" aria-label="返回">‹ 返回</button><b>選擇分類</b></div>
    ${groups.map(([n,cs])=>`<div class="catgroup">${esc(n)}</div><div class="cats">${cs.map(c=>`<button class="cat" data-action="catpick" data-id="${esc(c.key)}" aria-pressed="${draft.catId===c.key}"><span class="e">${esc(c.emoji)}</span>${esc(c.name)}<span class="dot" style="background:${c.color};margin:2px 0 0"></span></button>`).join('')}</div>`).join('')}`;
}
function sheetRender(){
  const b=document.getElementById('sheetBody');if(!b||!draft)return;
  b.innerHTML=draft.view==='cats'?catPickerHtml():addHtml();
  const sh=document.getElementById('sheet');sh.classList.toggle('haskp',!!document.getElementById('kp'));sh.classList.remove('kp-hide');
  if(draft.view!=='cats')updateHint();
}
// a category key is a personal category id, or 'jc:<jarId>:<catId>' for a shared jar's own category
function resolveCat(key){
  if(!key)return null;
  if(key.startsWith('jc:')){const [,jid,cid]=key.split(':');const j=Cloud.jars[jid];const c=j&&(j.categories||[]).find(x=>x.id===cid);
    return c?{key,emoji:c.emoji,name:c.name,shared:true,jid}:null}
  const c=catById(key);if(!c)return null;
  if(isSJ(c.bucketId))return Cloud.jars[sjId(c.bucketId)]?{key,emoji:c.emoji,name:c.name,shared:true,jid:sjId(c.bucketId)}:null;
  return {key,emoji:c.emoji,name:c.name,shared:false,bucketId:c.bucketId};
}
function addHtml(){
  const d=draft;const editing=d.editId||d.editShared;
  if(d.expr===undefined)d.expr=d.amount?String(d.amount):'';
  const seg=[['expense','支出'],['income','收入'],['transfer','轉移']].map(([k,l])=>`<button data-action="type" data-t="${k}" aria-pressed="${d.type===k}">${l}</button>`).join('');
  const jarOpts=sel=>jarsList().map(j=>`<option value="${SJ+j.id}" ${SJ+j.id===sel?'selected':''}>${esc(j.name)}（共用）</option>`).join('');
  const opts=sel=>S.buckets.map(b=>`<option value="${b.id}" ${b.id===sel?'selected':''}>${esc(b.name)}</option>`).join('')+jarOpts(sel);
  const catBtn=(key,emoji,name,color)=>`<button class="cat" data-action="cat" data-id="${esc(key)}" aria-pressed="${d.catId===key}"><span class="e">${esc(emoji)}</span>${esc(name)}<span class="dot" style="background:${color};margin:2px 0 0"></span></button>`;
  let body='';
  if(d.type==='expense'){
    body=`<div class="catstrip">${topCats(6).map(c=>`<button class="catchip" data-action="cat" data-id="${esc(c.key)}" aria-pressed="${d.catId===c.key}"><span class="e">${esc(c.emoji)}</span>${esc(c.name)}<span class="dot" style="background:${c.color};margin:0"></span></button>`).join('')}
      <button class="catchip all" data-action="catall">全部 ›</button></div>`;
  }else if(d.type==='income'){
    body=`<div class="row2"><label class="f">分配方式<select id="mode"><option value="pct" ${d.mode==='pct'?'selected':''}>依每月計畫分配</option><option value="one" ${d.mode==='one'?'selected':''}>全部放入一罐</option></select></label>
    <label class="f ${d.mode==='one'?'':'hidden'}" id="tgtWrap">放入<select id="tgt">${opts(d.target)}</select></label></div>`;
  }else{
    body=`<div class="row2"><label class="f">從<select id="from">${opts(d.from)}</select></label><label class="f">到<select id="to">${opts(d.to)}</select></label></div>`;
  }
  return `${editing?'<h2 style="margin:0 0 12px">編輯紀錄</h2>':''}${d.editShared?'':`<div class="seg">${seg}</div>`}
  <button type="button" class="amount" id="amtBox" data-action="kpshow" aria-label="金額">${amountInner()}</button>
  ${body}
  <p class="hint" id="hint"></p>
  <div class="row2"><label class="f">日期<input type="date" id="date" value="${d.date}"></label><label class="f">${d.type==='income'?'來源':'備註'}<input type="text" id="note" value="${esc(d.note)}" placeholder="${d.type==='income'?'例如：薪水':'選填'}"></label></div>
  ${d.editId?`<button class="ghost danger" style="width:100%;margin-top:14px" data-action="deltx" data-id="${d.editId}">刪除這筆</button>`:''}${d.editShared?`<button class="ghost danger" style="width:100%;margin-top:14px" data-action="delstx" data-jid="${d.editShared.jid}" data-id="${esc(d.editShared.id)}">刪除這筆</button>`:''}
  ${keypadHtml()}`;
}
function updateHint(){
  const d=draft;if(!d)return;const h=document.getElementById('hint');const btn=document.getElementById('saveBtn');
  const amt=Math.round(+d.amount||0),mk=(d.date||today()).slice(0,7);let ok=amt>0,msg='';
  const exShared=d.editShared?d.editShared.id:undefined;
  if(d.type==='expense'){
    const c=resolveCat(d.catId);ok=ok&&!!c;
    if(c){const id=c.shared?SJ+c.jid:c.bucketId;const after=(c.shared?jarStats(c.jid,mk,exShared).bal:balanceOf(id,mk,d.editId))-amt;
      const b=!c.shared&&bucketById(id),cv=b&&coverOf(b);
      // the jar's own balance before covering / being covered (what it covers for others doesn't trigger its own cover)
      let own=0;if(cv){const s=stats(d.editId,mk)[id]||{bal:0};own=Math.max(0,s.bal-(s.over||0)+(s.covered||0))}
      if(cv&&amt>own)
        msg=`「<b>${esc(b.name)}</b>」只剩 ${money(own)}，超出的 <span class="neg">${money(amt-own)}</span> 會由「<b>${esc(cv.name)}</b>」墊付`;
      else msg=`從「<b>${esc(nameOf(id))}</b>」扣除，扣完剩 <span class="${after<0?'neg':''}">${money(after)}</span>${after<0?'（會超支）':''}`}
    else msg='選一個分類';
  }else if(d.type==='income'){
    if(amt>0){
      let a;
      if(d.mode==='one')a=allocate(amt,'one',d.target);
      else{
        const T0=planTotals(d.editId)[mk]||0,a0=planAlloc(T0,mk),a1=planAlloc(T0+amt,mk);
        a={};for(const k in a1)a[k]=a1[k]-(a0[k]||0);
        if(S.allocMode==='amount'){
          const P=planSum(mk),T=T0+amt;
          const tail=P<=0?'還沒設定每月計畫金額，會全部放入「'+esc(excessBucket().name)+'」':T>=P?(T>P?`本月收入 ${money(T)}，超過計畫 ${money(T-P)}，多的放入「${esc(excessBucket().name)}」`:`本月收入剛好達到計畫 ${money(P)}`):`本月收入 ${money(T)}，還差 ${money(P-T)} 達到計畫，先依比例分配`;
          msg='<br>'+tail;
        }
      }
      msg=Object.entries(a).filter(([,v])=>v).map(([k,v])=>`${esc(nameOf(k))} <b>${v<0?'−':'+'}${money(Math.abs(v))}</b>`).join('　')+msg;
    }
    else msg='輸入金額後會顯示分配結果';
  }else{
    const both=isSJ(d.from)&&isSJ(d.to);
    ok=ok&&d.from!==d.to&&!both;
    msg=d.from===d.to?'請選兩個不同的罐子':both?'共用罐之間不能直接轉移，請經過自己的罐子':`「${esc(nameOf(d.from))}」目前有 ${money(balanceOf(d.from,mk,d.editId))}`;
  }
  h.innerHTML=msg;d.ok=ok;updateKeypad();
}
function jarTxnRef(jid,id){return Cloud.fs.collection('jars').doc(jid).collection('txns').doc(id)}
function saveDraft(){
  const d=draft;const amt=Math.round(+d.amount||0);if(amt<=0)return;
  const oldP=d.editId?S.txns.find(t=>t.id===d.editId):null,oldS=d.editShared||null;
  const date=d.date||today(),note=(d.note||'').trim();
  const c=d.type==='expense'?resolveCat(d.catId):null;
  if(d.type==='expense'&&!c)return;
  if(c&&c.shared){ // goes into the shared jar
    if(!cloudOn()){toast('需要登入才能記到共用罐');return}
    const id=(oldS&&oldS.jid===c.jid)?oldS.id:uid();
    const keepSplit=oldS&&oldS.jid===c.jid&&oldS.split;
    const doc={kind:'expense',amount:amt,date,note,by:myUid(),byName:myName(),emoji:c.emoji,catName:c.name,catKey:c.key,split:keepSplit||((Cloud.jars[c.jid]||{}).members||[]).length||1,ts:(oldS&&oldS.ts)||Date.now()};
    jarTxnRef(c.jid,id).set(doc).catch(e=>toast('共用罐儲存失敗：'+(e.code||'')));
    if(oldS&&oldS.jid!==c.jid)jarTxnRef(oldS.jid,oldS.id).delete().catch(()=>{});
    if(oldP)removeTxn(oldP.id);
  }else{
    const base={id:oldP?oldP.id:uid(),ts:oldP?oldP.ts:Date.now(),type:d.type,amount:amt,date,note};
    if(d.type==='expense'){base.catId=c.key;base.bucketId=c.bucketId}
    else if(d.type==='income'){base.mode=d.mode;if(d.mode==='one')base.target=d.target}
    else{if(d.from===d.to||(isSJ(d.from)&&isSJ(d.to)))return;base.from=d.from;base.to=d.to}
    if((isSJ(base.target)||isSJ(base.from)||isSJ(base.to))&&!cloudOn()){toast('需要登入才能使用共用罐');return}
    putTxn(base);
    if(oldS)jarTxnRef(oldS.jid,oldS.id).delete().catch(()=>{});
  }
  closeSheet();render();toast(oldP||oldS?'已儲存變更':'已記下');
}
function openTx(id){
  const t=S.txns.find(x=>x.id===id);if(!t)return;
  const b0=S.buckets[0]?.id,b1=S.buckets[1]?.id||b0;
  draft={editId:t.id,type:t.type,amount:String(t.amount),date:t.date,note:t.note||'',
    catId:t.type==='expense'&&resolveCat(t.catId)?t.catId:null,
    mode:t.type==='income'?(t.mode||'pct'):'pct',target:(t.type==='income'&&t.target)||b0,
    from:t.from||b0,to:t.to||b1};
  openSheet(addHtml());
}
function openShared(jid,id){
  const t=(Cloud.jarTxns[jid]||[]).find(x=>x.id===id);if(!t)return;
  const me=myUid();
  if(t.by===me&&id.startsWith('m_')&&S.txns.find(x=>x.id===id.slice(2))){openTx(id.slice(2));return}
  if(t.by===me&&t.kind==='expense'){
    draft={editShared:{jid,id,ts:t.ts,split:t.split},type:'expense',amount:String(t.amount),date:t.date,note:t.note||'',catId:resolveCat(t.catKey)?t.catKey:null,mode:'pct'};
    openSheet(addHtml());return;
  }
  const why=t.by!==me?`這筆是 ${esc(t.byName||'成員')} 記的，只有記錄的人可以修改。`:t.kind==='contrib'?'這是你每月從自己的罐子撥進共用罐的金額。要調整的話，到設定頁修改這個共用罐的「每月撥款」。'
    :t.kind==='cover'?'共用罐這個月超支，依人數平分後，這是你的份額，從你設定的罐子墊付，不算支出。要調整的話，到設定頁修改這個共用罐的「共用罐超支時，我的份額從…扣」。':'這筆由你的帳本自動產生。';
  openSheet(`<ul class="txs">${sharedRow(t,true)}</ul><p class="note">${t.date}</p><p class="note">${why}</p>
    <button class="ghost" style="width:100%;margin-top:10px" data-action="close">關閉</button>`);
}
