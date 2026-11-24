// 總覽頁
/* ---------- views ---------- */
function render(){
  document.querySelectorAll('nav.tabs button').forEach(b=>b.setAttribute('aria-current',b.dataset.tab===tab?'page':'false'));
  const v=document.getElementById('view');
  v.innerHTML=tab==='home'?homeView():tab==='list'?listView():settingsView();
  if(tab==='list')highlightTerms(document.getElementById('listResults'));
}

function monthNav(){
  const [y,m]=listMonth.split('-').map(Number);
  const latest=horizon();
  return `<div class="mnav"><button class="arr" data-action="mshift" data-d="-1" aria-label="上個月">‹</button>
    <div class="mlabel">${y} 年 ${m} 月<input type="month" id="hm" value="${listMonth}" aria-label="選擇月份"></div>
    <button class="arr" data-action="mshift" data-d="1" aria-label="下個月" ${listMonth>=latest?'disabled':''}>›</button></div>`;
}
const clamp01=v=>Math.max(0,Math.min(1,v));
// water level: ratio 0–1. level(): 「空」 only when there was nothing to hold and nothing is left (running totals);
// shareLevel(): 「空」 whenever nothing came in (this month's share, unchanged from before v43)
const level=(bal,base)=>({ratio:base>0?clamp01(bal/base):0,empty:base<=0&&bal===0});
const shareLevel=(left,base)=>({ratio:base>0?clamp01(left/base):0,empty:!(base>0)});
// shared jars only (v43: personal jars use their type instead):
// this month's share: what it got, what it used, what is left of it (carried + left = bal)
function monthShare(s){const used=s.monthOut+(s.jarOut||0)+(s.covered||0);
  return {in:s.monthIn,used,left:s.bal-(s.open+(s.xferIn||0)-(s.xferOut||0))}}
// v41: a shared jar that got nothing this month shows its running total: level = bal ÷ (max(0,open) + transfers in)
function accumView(s){
  if(s.monthIn!==0)return null;
  const xi=s.xferIn||0,xo=s.xferOut||0,spent=s.monthOut+(s.jarOut||0)+(s.covered||0),avail=Math.max(0,s.open)+xi;
  return Object.assign({xi,xo,spent,avail},level(s.bal,avail));
}
// one line under the jar: transfers out, then spending, then transfers in, else 累積中
function accumSub(a){return a.xo?`本月轉出 ${money(a.xo)}`:a.spent?`本月支出 ${money(a.spent)}`:a.xi?`本月轉入 ${money(a.xi)}`:'累積中'}
/* v43 savings jar:
   本月存入 = monthIn (plan share, income above the plan, 全部放入 income; transfers and last month's settlement excluded)
   本月墊付 = covering other personal jars; 本月支出 = own spending + money put into shared jars
   本月淨存 = 存入 − 墊付 − 支出 (transfers never change it); level = bal ÷ (max(0,open) + 存入 + 轉入) */
function saveView(s){
  const inn=s.monthIn,cov=s.covered||0,spent=s.monthOut+(s.jarOut||0),xi=s.xferIn||0,xo=s.xferOut||0;
  return Object.assign({inn,cov,spent,xi,xo,net:inn-cov-spent,active:!!(inn||cov||spent)},level(s.bal,Math.max(0,s.open)+inn+xi));
}
const netText=n=>n<0?`本月淨減 ${money(-n)}`:`本月淨存 ${money(n)}`;
// one line under a savings jar: net saved (if anything was saved / covered / spent), else transfers, else 累積中
function saveSub(v){
  if(v.active)return netText(v.net);
  const x=[];if(v.xi)x.push(`轉入 ${money(v.xi)}`);if(v.xo)x.push(`轉出 ${money(v.xo)}`);
  return x.length?'本月'+x.join('・'):'累積中';
}
// v43 spending jar: transfers count in the month; level = bal ÷ (max(0,open) + this month's in)
const spendLevel=s=>shareLevel(s.bal,Math.max(0,s.open)+s.monthIn);
// 「含美樂蒂 $1,500」：撥給共用罐的錢（每月撥款＋超支墊付），算這個罐子的支出
function jarPartsText(s){return (s.jarParts||[]).filter(p=>p.amount).map(p=>`${esc(jarName(sjId(p.id)))} ${money(p.amount)}`).join('・')}
// lv = {ratio, empty} from level() / saveView() / accumView()
function jarCol(id,name,color,s,sub,shared,bad,lv){
  const ratio=lv.ratio;
  return `<div class="jarcol" role="button" tabindex="0" data-action="jump" data-bucket="${id}" aria-label="${esc(name)}，月底餘額 ${money(s.bal)}，${sub}">
    <div class="jar ${s.bal<0||s.over?'neg':''}"><div class="fill" style="height:${(ratio*100).toFixed(1)}%;background:${color}"></div>
    <div class="jarpct num" ${ratio>0.12?`style="color:${textOn(color)}"`:''}>${lv.empty?'空':Math.round(ratio*100)+'%'}</div></div>
    <div class="jarname">${esc(name)}${shared?'<span class="pill">共用</span>':''}</div>
    <div class="jarbal num ${s.bal<0?'neg':''}">${money(s.bal)}</div>
    <div class="jarsub ${bad?'bad':''}">${sub}</div></div>`;
}
// cover relations: names of the jars this jar covered, and the jar that covered it
function coverNames(s){return [...new Set((s.coverParts||[]).map(p=>isSJ(p.id)?nameOf(p.id):(bucketById(p.id)||{}).name||''))].map(esc).join('、')}
// shared jar: this month's new overspending, and who hasn't covered their share yet
function jarOverLine(jid,month){
  const j=Cloud.jars[jid],o=j&&jarOver(jid,month);if(!o||!o.over)return '';
  const me=myUid();
  if(!o.unpaid.length){ // all covered: 「超支已由兩人各墊付 $150」, or each payer when the amounts differ
    const nm=u=>esc(u===me?'你':memberName(j,u)),ps=Object.keys(o.paid).filter(u=>o.paid[u]>0);
    const amts=[...new Set(ps.map(u=>o.paid[u]))];
    const txt=ps.length===1?`${nm(ps[0])}墊付 ${money(o.paid[ps[0]])}`
      :amts.length===1?`${ps.length===2?'兩':ps.length+' '}人各墊付 ${money(amts[0])}`
      :ps.map(u=>`${nm(u)}墊付 ${money(o.paid[u])}`).join('、');
    return `<br><span class="note">超支已由${txt}</span>`;
  }
  return `<br><span class="neg">超支 ${money(o.over)}・${o.unpaid.map(x=>`${esc(x.uid===me?'你':memberName(j,x.uid))}尚未墊付 ${money(x.amount)}`).join('、')}</span>`;
}
function coveredByName(s){return esc((bucketById(s.coveredBy)||{}).name||'')}
const overLine=s=>s.over?`<br><span class="neg">超支 ${money(s.over)} 由${coveredByName(s)}墊付</span>`:'';
function leftSub(left){return left<0?`本月超用 ${money(-left)}`:`本月剩 ${money(left)}`}
// my share of a shared expense: split by the member count when it was recorded
function myShare(t){const n=t.split||((Cloud.jars[t.jid]||{}).members||[]).length||1;return Math.round(t.amount/n)}
const mrowHtml=(name,color,shared,lab,w,barColor)=>`<div class="mrow"><div class="lab"><span><span class="dot" style="background:${color}"></span>${esc(name)}${shared?'（共用）':''}</span><span class="num">${lab}</span></div>
  <div class="bar" style="display:flex"><i style="width:${(+w).toFixed(1)}%;background:${barColor||color}"></i></div></div>`;
// b: the personal jar (null for a shared jar)
function monthRow(name,color,s,shared,jid,b){
  if(shared){
    const a=accumView(s);
    if(a){ // v41, got nothing this month: 本月轉入 $I・轉出 $X・支出 $S ／ 累積 $T (only what changed), or just 累積 $T
      const parts=[];
      if(a.xi)parts.push(`轉入 ${money(a.xi)}`);if(a.xo)parts.push(`轉出 ${money(a.xo)}`);if(a.spent)parts.push(`支出 ${money(a.spent)}`);
      const tot=`累積 ${money(s.bal)}`,line=parts.length?`本月${parts.join('・')} ／ ${tot}`:tot;
      return mrowHtml(name,color,true,line+jarOverLine(jid,listMonth),a.ratio*100);
    }
    // 撥入 $2,000・共用支出 $2,300 ／ 本月剩 −$300 (covers are not part of 撥入 or 本月剩; noted below instead)
    const inn=s.monthIn-(s.monthCover||0),l=inn-s.monthOut,used=s.monthOut;
    const left=(l<0?`<span class="neg">本月剩 ${money(l)}</span>`:`本月剩 ${money(l)}`)+jarOverLine(jid,listMonth);
    const w=inn>0?Math.min(100,used/inn*100):(used>0?100:0);
    return mrowHtml(name,color,true,`撥入 ${money(inn)}・共用支出 ${money(s.monthOut)} ／ ${left}<br><span class="note">累積 ${money(s.bal)}${s.xferIn?`・本月轉入 ${money(s.xferIn)}`:''}${s.xferOut?`・轉出 ${money(s.xferOut)}`:''}</span>`,w,used>inn?'var(--neg)':'');
  }
  const jt=jarPartsText(s),cov=s.covered||0;
  if(isSave(b)){ // v43 savings jar: 本月存入 $A・墊付 $B・支出 $C ／ 本月淨存 $N, then 累積 $T (+ transfers)
    const v=saveView(s),parts=[];
    if(v.inn)parts.push(`本月存入 ${money(v.inn)}`);if(v.cov)parts.push(`墊付 ${money(v.cov)}`);
    if(v.spent)parts.push(`支出 ${money(v.spent)}${jt?`（含${jt}）`:''}`);
    const x=[];if(v.xi)x.push(`轉入 ${money(v.xi)}`);if(v.xo)x.push(`轉出 ${money(v.xo)}`);
    const tot=`累積 ${money(s.bal)}${x.length?'・本月'+x.join('・'):''}`;
    const lab=v.active?`${parts.join('・')} ／ ${v.net<0?`<span class="neg">${netText(v.net)}</span>`:netText(v.net)}${overLine(s)}<br><span class="note">${tot}</span>`:tot+overLine(s);
    return mrowHtml(name,color,false,lab,v.ratio*100);
  }
  // spending jar: transfers count in the month; spent includes the money put into shared jars;
  // covering another personal jar uses this jar's money too
  const avail=Math.max(0,s.open)+s.monthIn,spent=s.monthOut+(s.jarOut||0),used=spent+cov,base=Math.max(avail,used,1);
  const covNote=cov?`替${coverNames(s)}墊付 ${money(cov)}`:'';
  let lab;
  if(carries(b)){ // 留到下個月: 本月分到 $A・花了 $B ／ 可用 $C (= what is in the jar now), noting what last month left
    const o=s.open,notes=[];
    if(o>0)notes.push(`上月留下 ${money(o)}`);else if(o<0)notes.push(`<span class="neg">上月不足 ${money(-o)}</span>`);
    if(covNote)notes.push(covNote);
    lab=`本月分到 ${money(s.monthIn)}・花了 ${money(spent)}${jt?`（含${jt}）`:''} ／ 可用 ${money(s.bal)}${overLine(s)}${notes.length?`<br><span class="note">${notes.join('・')}</span>`:''}`;
  }
  else lab=`花了 ${money(spent)}${jt?`（含${jt}）`:''} ／ 可用 ${money(avail)}${overLine(s)}${covNote?`<br><span class="note">${covNote}</span>`:''}`;
  return mrowHtml(name,color,false,lab,Math.min(100,Math.max(0,used)/base*100),used>avail?'var(--neg)':'');
}
// my monthly contribution and overspending cover, as spending rows of the jar they come from (same numbers as stats())
function jarSpendItems(month,filter){
  if(month===null)return []; // searching all months only matches notes; these rows have none
  const st=stats(null,month),rows=[];
  for(const b of S.buckets){if(filter!=='all'&&filter!==b.id)continue;
    for(const p of ((st[b.id]||{}).jarParts||[])){const jid=sjId(p.id);
      for(const kind of ['contrib','cover']){const v=p[kind];
        if(v)rows.push({jarSpend:true,id:'js_'+kind+'_'+jid+'_'+b.id,date:month+'-01',ts:0,jid,kind,amount:v,src:b.id})}}}
  return rows;
}
// expenses recorded inside my shared jars (full amount, display only — not my spending); month null = all months
function sharedExpenseItems(month){
  const rows=[];
  for(const j of jarsList())for(const t of (Cloud.jarTxns[j.id]||[]))if(t.kind==='expense'&&(month===null||t.date.slice(0,7)===month))rows.push(t);
  return rows;
}
// 全部 shows shared expenses at full amount; this line says what my spending counts instead
function sharedFullNote(items){
  const names=jarsList().filter(j=>items.some(t=>t.jid===j.id)).map(j=>esc(j.name));
  return names.length?`<br><span class="note">${names.join('、')}的紀錄為共用支出全額，你的實際支出以撥款與墊付計算。</span>`:'';
}
// records for a month.
// 全部 (what the money was spent on): my own records + the expenses inside my shared jars; no contribution / cover rows.
// A personal jar (where its money went): its own records + my contributions and covers into shared jars.
// A shared jar: all of its records (display only; its expenses are not my spending).
function monthItems(month,filter){
  filter=filter||'all';
  if(isSJ(filter)){
    const jid=sjId(filter);if(!Cloud.jars[jid])return [];
    return (Cloud.jarTxns[jid]||[]).filter(t=>month===null||t.date.slice(0,7)===month).sort(sortTx);
  }
  const rel=t=>filter==='all'||(t.type==='expense'&&t.bucketId===filter)||(t.type==='income'&&incAlloc(t)[filter])||(t.type==='transfer'&&(t.from===filter||t.to===filter));
  const own=S.txns.filter(t=>(month===null||t.date.slice(0,7)===month)&&rel(t));
  return own.concat(filter==='all'?sharedExpenseItems(month):jarSpendItems(month,filter)).sort(sortTx);
}
function homeView(){
  const st=stats(null,listMonth);
  const order=shelfIds(),shared=jarsList();
  const jars=order.map(id=>{
    if(isSJ(id)){const j=Cloud.jars[sjId(id)],s=jarStats(sjId(id),listMonth),a=accumView(s);
      if(a)return jarCol(id,j.name,j.color,s,accumSub(a),true,false,a); // v41: no contribution this month
      const m=monthShare(s);return jarCol(id,j.name,j.color,s,leftSub(m.left),true,m.left<0,shareLevel(m.left,m.in))}
    const b=bucketById(id),s=st[b.id];
    if(isSave(b)){const v=saveView(s); // v43 savings jar; covered: own overspending in red first
      if(s.over)return jarCol(b.id,b.name,b.color,s,`超支 ${money(s.over)}`,false,true,v);
      return jarCol(b.id,b.name,b.color,s,saveSub(v),false,v.active&&v.net<0,v)}
    // spending jar: 留到下個月 shows 可用 $X (what is in the jar), otherwise 每月歸零
    return jarCol(b.id,b.name,b.color,s,s.short?`超支 ${money(s.short)}`:carries(b)?`可用 ${money(s.bal)}`:'每月歸零',false,!!s.short,spendLevel(s))}).join('');
  const sjars='';
  const total=S.buckets.reduce((a,b)=>a+st[b.id].bal,0);
  const monthRows=order.map(id=>{if(isSJ(id)){const j=Cloud.jars[sjId(id)];return monthRow(j.name,j.color,jarStats(sjId(id),listMonth),true,sjId(id))}const b=bucketById(id);return monthRow(b.name,b.color,st[b.id],false,null,b)}).join('');
  const own=ownSpend(listMonth),sm=sharedSpend(listMonth,st);
  const spendNote=sm.parts.length?`<br><span class="note">個人 ${money(own)}${sm.parts.map(p=>`＋${esc(jarName(sjId(p.id)))} ${money(p.amount)}`).join('')}</span>`:'';
  const items=monthItems(listMonth,'all'),fullNote=sharedFullNote(items);
  const isNow=listMonth===curMonth();
  const any=S.txns.length||shared.length;
  const empty=!any?`<div class="empty">先記一筆收入，錢會依計畫分進各個罐子。</div>`:'';
  return `${cloudOn()?invitesHtml():''}${monthNav()}${listMonth<curMonth()?`<button class="sumbtn" data-action="summary">📊 查看 ${+listMonth.slice(5)} 月結算</button>`:''}<div class="shelf">${jars}${sjars}</div>
  <div class="total"><span>${isNow?'目前':'月底'}${shared.length?'我的罐子':'所有罐子'}合計</span><b class="num ${total<0?'neg':''}">${money(total)}</b></div>
  ${empty}
  ${any?`<div class="total" style="margin-top:0;border-top:0"><span>這個月支出</span><span class="num"><b>${money(own+sm.total)}</b>${spendNote}${fullNote}</span></div>
  <h2>這個月各罐</h2><div class="month-row">${monthRows}</div>
  <h2>這個月的紀錄</h2>${items.length?`<ul class="txs">${items.slice(0,8).map(t=>rowOf(t,true)).join('')}</ul>${items.length>8?`<button class="more" data-action="tolist">查看這個月全部 ${items.length} 筆 ›</button>`:''}`:'<div class="empty">這個月還沒有紀錄。</div>'}`:''}`;
}
