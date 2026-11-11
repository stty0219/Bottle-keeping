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
// this month's share of a carrying jar / shared jar: what it got, what it used (incl. covering), what is left of it
function monthShare(s){const used=s.monthOut+(s.covered||0);return {in:s.monthIn,used,left:s.bal-s.open}}
// carrying jars show this month's share (water level = left ÷ got); reset jars keep the old level
function jarCol(id,name,color,s,sub,shared,bad,carry){
  let base,ratio;
  if(carry){const m=monthShare(s);base=m.in;ratio=base>0?Math.max(0,Math.min(1,m.left/base)):0}
  else{base=Math.max(0,s.open)+s.monthIn;ratio=base>0?Math.max(0,Math.min(1,s.bal/base)):0}
  return `<div class="jarcol" role="button" tabindex="0" data-action="jump" data-bucket="${id}" aria-label="${esc(name)}，月底餘額 ${money(s.bal)}，${sub}">
    <div class="jar ${s.bal<0||s.over?'neg':''}"><div class="fill" style="height:${(ratio*100).toFixed(1)}%;background:${color}"></div>
    <div class="jarpct num" ${ratio>0.12?`style="color:${textOn(color)}"`:''}>${base>0?Math.round(ratio*100)+'%':'空'}</div></div>
    <div class="jarname">${esc(name)}${shared?'<span class="pill">共用</span>':''}</div>
    <div class="jarbal num ${s.bal<0?'neg':''}">${money(s.bal)}</div>
    <div class="jarsub ${bad?'bad':''}">${sub}</div></div>`;
}
function leftSub(left){return left<0?`本月超用 ${money(-left)}`:`本月剩 ${money(left)}`}
// my share of a shared expense: split by the member count when it was recorded
function myShare(t){const n=t.split||((Cloud.jars[t.jid]||{}).members||[]).length||1;return Math.round(t.amount/n)}
function sharedMonth(month){ // shared expenses this month: total and my share
  let total=0,share=0;
  for(const j of jarsList())for(const t of (Cloud.jarTxns[j.id]||[]))if(t.kind==='expense'&&t.date.slice(0,7)===month){total+=t.amount;share+=myShare(t)}
  return {total,share};
}
function monthRow(name,color,s,shared,jid,carry){
  if(shared||carry){ // this month's share: got / used / left, then the running total
    const m=monthShare(s);
    let first;
    if(shared)first=`本月撥入 ${money(m.in)}・共用支出 ${money(s.monthOut)}（你的份額 ${money(jarShare(jid,listMonth))}）`;
    else{const parts=[];if(s.covered)parts.push(`墊付 ${money(s.covered)}`);if(s.monthJar)parts.push(`撥共用 ${money(s.monthJar)}`);
      first=`本月分到 ${money(m.in)}・用掉 ${money(m.used)}${parts.length?`（含${parts.join('・')}）`:''}`}
    const left=m.left<0?`<span class="neg">${leftSub(m.left)}</span>`:leftSub(m.left);
    const w=m.in>0?Math.min(100,m.used/m.in*100):(m.used>0?100:0);
    return `<div class="mrow"><div class="lab"><span><span class="dot" style="background:${color}"></span>${esc(name)}${shared?'（共用）':''}</span><span class="num">${first} ／ ${left}<br><span class="note">累積 ${money(s.bal)}</span></span></div>
  <div class="bar" style="display:flex"><i style="width:${w}%;background:${m.used>m.in?'var(--neg)':color}"></i></div></div>`;
  }
  const avail=Math.max(0,s.open)+s.monthIn;
  const spent=s.monthOut-(s.monthJar||0),used=s.monthOut,base=Math.max(avail,used,1);
  const lab=`花了 ${money(spent)}${s.monthJar?`・撥共用 ${money(s.monthJar)}`:''} ／ 可用 ${money(avail)}${s.over?`<br><span class="neg">超支 ${money(s.over)} 由${esc(remainderBucket().name)}墊付</span>`:''}${s.covered?`<br><span class="note">已墊付超支 ${money(s.covered)}</span>`:''}`;
  const jarW=s.monthJar?Math.min(100,s.monthJar/base*100):0,spW=Math.min(100-jarW,Math.max(0,spent)/base*100);
  return `<div class="mrow"><div class="lab"><span><span class="dot" style="background:${color}"></span>${esc(name)}${shared?'（共用）':''}</span><span class="num">${lab}</span></div>
  <div class="bar" style="display:flex">${jarW?`<i style="width:${jarW}%;background:${color};opacity:.45;border-radius:4px 0 0 4px"></i>`:''}<i style="width:${spW}%;background:${used>avail?'var(--neg)':color};${jarW?'border-radius:0 4px 4px 0':''}"></i></div></div>`;
}
function jarShare(jid,month){let s=0;for(const t of (Cloud.jarTxns[jid]||[]))if(t.kind==='expense'&&t.date.slice(0,7)===month)s+=myShare(t);return s}
// records for a month: my own records + shared-jar records.
// My mirrored transfers already appear as my own transfers; my monthly contribution shows under its source jar.
function monthItems(month,filter){
  const me=myUid();filter=filter||'all';
  let own=[],sh=[];
  if(!isSJ(filter)){
    const rel=t=>filter==='all'||(t.type==='expense'&&t.bucketId===filter)||(t.type==='income'&&incAlloc(t)[filter])||(t.type==='transfer'&&(t.from===filter||t.to===filter));
    own=S.txns.filter(t=>(month===null||t.date.slice(0,7)===month)&&rel(t));
  }
  for(const j of jarsList()){
    if(isSJ(filter)&&sjId(filter)!==j.id)continue;
    for(const t of (Cloud.jarTxns[j.id]||[])){
      if(month!==null&&t.date.slice(0,7)!==month)continue;
      if(!isSJ(filter)){
        const mineContrib=t.by===me&&t.kind==='contrib';
        if(filter!=='all'){if(!(mineContrib&&t.srcId===filter))continue}
        else if(t.by===me&&isMirror(t)&&!mineContrib)continue;
      }
      sh.push(t);
    }
  }
  return own.concat(sh).sort(sortTx);
}
function homeView(){
  const st=stats(null,listMonth);
  const order=shelfIds(),shared=jarsList();
  const jars=order.map(id=>{
    if(isSJ(id)){const j=Cloud.jars[sjId(id)],s=jarStats(sjId(id),listMonth),l=monthShare(s).left;return jarCol(id,j.name,j.color,s,leftSub(l),true,l<0,true)}
    const b=bucketById(id),s=st[b.id];
    if(carries(b)){const l=monthShare(s).left;return jarCol(b.id,b.name,b.color,s,leftSub(l),false,l<0,true)}
    return jarCol(b.id,b.name,b.color,s,s.over?`超支 ${money(s.over)}`:'每月歸零',false,!!s.over,false)}).join('');
  const sjars='';
  const total=S.buckets.reduce((a,b)=>a+st[b.id].bal,0);
  const monthRows=order.map(id=>{if(isSJ(id)){const j=Cloud.jars[sjId(id)];return monthRow(j.name,j.color,jarStats(sjId(id),listMonth),true,sjId(id))}const b=bucketById(id);return monthRow(b.name,b.color,st[b.id],false,null,carries(b))}).join('');
  const own=S.txns.filter(t=>t.type==='expense'&&t.date.slice(0,7)===listMonth).reduce((a,t)=>a+t.amount,0),sm=sharedMonth(listMonth);
  const items=monthItems(listMonth,'all');
  const isNow=listMonth===curMonth();
  const any=S.txns.length||shared.length;
  const empty=!any?`<div class="empty">先記一筆收入，錢會依計畫分進各個罐子。</div>`:'';
  return `${cloudOn()?invitesHtml():''}${monthNav()}${listMonth<curMonth()?`<button class="sumbtn" data-action="summary">📊 查看 ${+listMonth.slice(5)} 月結算</button>`:''}<div class="shelf">${jars}${sjars}</div>
  <div class="total"><span>${isNow?'目前':'月底'}${shared.length?'我的罐子':'所有罐子'}合計</span><b class="num ${total<0?'neg':''}">${money(total)}</b></div>
  ${empty}
  ${any?`<div class="total" style="margin-top:0;border-top:0"><span>這個月支出</span><span class="num"><b>${money(own+sm.share)}</b>${shared.length?`<br><span class="note">個人 ${money(own)}＋共用份額 ${money(sm.share)}</span>`:''}</span></div>
  <h2>這個月各罐</h2><div class="month-row">${monthRows}</div>
  <h2>這個月的紀錄</h2>${items.length?`<ul class="txs">${items.slice(0,8).map(rowOf).join('')}</ul>${items.length>8?`<button class="more" data-action="tolist">查看這個月全部 ${items.length} 筆 ›</button>`:''}`:'<div class="empty">這個月還沒有紀錄。</div>'}`:''}`;
}
