// 明細頁：紀錄列、月初結算、圓餅圖、搜尋
const rowOf=t=>t.sys?sysRow(t):t.jid?sharedRow(t):txRow(t);
// carry-over and month-end settlement, shown on the 1st; display only (never counted in totals)
function sysItems(month,filter){
  const st=stats(null,month),rows=[],date=month+'-01',prev=shiftMonth(month,-1);
  const mlabel=mk=>mk===prev?'上月':(+mk.slice(5))+'月';
  const want=id=>filter==='all'||filter===id;
  const sw=sweepBucket();
  for(const b of S.buckets){
    const s=st[b.id];if(!s||!want(b.id))continue;
    if(carries(b)){
      const own=s.open-(sw&&sw.id===b.id?(s.sweep||0):0);
      if(own)rows.push({sys:true,id:'sys_c_'+b.id,date,ts:-1,amount:own,color:b.color,jar:b.name,label:own>0?'上月結轉':'上月超支'});
    }
    if(sw&&sw.id===b.id)for(const p of (s.sweepParts||[])){
      const src=bucketById(p.id);if(!src)continue;
      rows.push({sys:true,id:'sys_s_'+p.id,date,ts:-2,amount:p.amount,color:b.color,jar:b.name,label:mlabel(s.sweepMonth||prev)+src.name+(p.amount>0?'剩餘':'不足')});
    }
  }
  for(const j of jarsList()){
    if(!want(SJ+j.id))continue;
    const o=jarStats(j.id,month).open;
    if(o)rows.push({sys:true,shared:true,id:'sys_j_'+j.id,date,ts:-1,amount:o,color:j.color,jar:j.name+'（共用）',label:o>0?'上月結轉':'上月超支'});
  }
  return rows;
}
// 月初結算: collapsed to one net line, expand for the individual carry-overs and settlements
let coverOpen=false;
function coverItems(month,filter){ // this month's overspending: which jar covered which, and how much
  const rows=[],date=month+'-01';
  if(isSJ(filter)){ // a shared jar: what each member covered, and who still owes their share
    const jid=sjId(filter),j=Cloud.jars[jid];if(!j)return rows;
    const o=jarOver(jid,month),me=myUid(),nm=u=>u===me?'你':memberName(j,u);
    for(const t of (Cloud.jarTxns[jid]||[]))if(t.kind==='cover'&&t.date.slice(0,7)===month)
      rows.push({sys:true,id:'cov_'+t.id,ic:'🩹',date,amount:-t.amount,color:j.color,jar:t.src?`從${t.src}`:'',label:`${nm(t.by)}已墊付`});
    for(const x of o.unpaid)
      rows.push({sys:true,id:'cov_u_'+x.uid,date,amount:-x.amount,neg:true,color:j.color,jar:`每人份額 ${money(o.share)}`,label:`${nm(x.uid)}尚未墊付`});
    rows.total=o.over;
    return rows;
  }
  const st=stats(null,month);
  for(const cb of S.buckets){
    for(const p of ((st[cb.id]||{}).coverParts||[])){
      if(filter!=='all'&&filter!==cb.id&&filter!==p.id)continue;
      if(isSJ(p.id)){rows.push({sys:true,id:'cov_'+p.id,ic:'🩹',date,amount:-p.amount,color:cb.color,jar:`從${cb.name}`,label:`替${nameOf(p.id)}墊付`});continue}
      const b=bucketById(p.id);if(!b)continue;
      rows.push({sys:true,id:'cov_'+p.id,date,amount:-p.amount,color:b.color,jar:`由${cb.name}墊付`,label:`${b.name}超支`});
    }
  }
  return rows;
}
function coverHtml(rows){
  if(!rows.length)return '';
  const total=rows.total!=null?rows.total:rows.reduce((a,r)=>a-r.amount,0);
  return `<div class="settle ${coverOpen?'open':''}"><button class="settle-h" data-action="cover" aria-expanded="${coverOpen}">
      <span class="lbl">本月超支墊付</span><span class="net num">共 <b class="neg">${money(total)}</b><span class="chev">›</span></span></button>
    <ul class="txs settle-list">${rows.map(sysRow).join('')}</ul></div>`;
}
let settleOpen=false;
function settleHtml(rows){
  if(!rows.length)return '';
  const net=rows.filter(r=>listBucket!=='all'||!r.shared).reduce((a,r)=>a+r.amount,0);
  const sign=net>0?'+':net<0?'−':'';
  return `<div class="settle ${settleOpen?'open':''}"><button class="settle-h" data-action="settle" aria-expanded="${settleOpen}">
      <span class="lbl">月初結算</span><span class="net num">淨額 <b class="${net<0?'neg':''}">${sign}${money(Math.abs(net)).replace('−','')}</b><span class="chev">›</span></span></button>
    <ul class="txs settle-list">${rows.map(sysRow).join('')}</ul></div>`;
}
function sysRow(t){
  const pos=t.amount>0;
  return `<li><div class="tx sys" aria-label="${esc(t.label)} ${money(t.amount)}"><span class="ic">${t.ic||(t.id.startsWith('sys_s_')?(pos?'🪙':'⚠️'):(pos?'↩️':'⚠️'))}</span><span class="mid"><div class="t1${t.neg?' neg':''}">${esc(t.label)}</div>
    <div class="t2"><span class="dot" style="background:${t.color}"></span>${esc(t.jar)}</div></span><span class="amt num ${pos?'in':''}${t.neg?' neg':''}">${pos?'+':'−'}${money(Math.abs(t.amount))}</span></div></li>`;
}
const delAct=ref=>`<div class="del-act"><button data-action="swdel" data-ref="${esc(ref)}" tabindex="-1">刪除</button></div>`;
function sharedRow(t,noSwipe){
  const j=Cloud.jars[t.jid]||{};const me=myUid();
  let ic='🧾',t1='',sign='−',cls='';
  if(t.kind==='expense'){ic=t.emoji||'🧾';t1=t.catName||'支出'}
  else if(t.kind==='contrib'){ic='🫙';t1='每月撥款';sign='+';cls='in'}
  else if(t.kind==='cover'){ic='🩹';t1='超支墊付';sign='+';cls='in'}
  else if(t.kind==='in'){ic='💵';t1=t.note||'投入';sign='+';cls='in'}
  else{ic='🔁';t1='從共用罐轉出'}
  const who=t.by===me?'你':(t.byName||'成員');
  const extra=((t.kind==='in'||t.kind==='contrib'||t.kind==='cover')&&t.src?'從'+esc(t.src)+'・':'')+(t.kind==='withdraw'&&t.src?'到'+esc(t.src)+'・':'')+(t.note&&t.kind!=='in'?esc(t.note)+'・':'');
  const canDel=!noSwipe&&t.by===me&&(t.kind==='expense'||((t.id||'').startsWith('m_')&&S.txns.some(x=>x.id===t.id.slice(2))));
  const ref=t.kind==='expense'?'s:'+t.jid+':'+t.id:'p:'+(t.id||'').slice(2);
  return `<li${canDel?` class="swipe"`:''}>${canDel?delAct(ref):''}<button class="tx" data-action="stx" data-jid="${t.jid}" data-id="${esc(t.id)}"><span class="ic">${ic}</span><span class="mid"><div class="t1">${esc(t1)}</div>
    <div class="t2"><span class="dot" style="background:${j.color||'#999'}"></span>${esc(j.name||'共用罐')}（共用）・${extra}${esc(who)}${t.kind==='expense'?'・你的份額 '+money(myShare(t)):''}</div></span><span class="amt num ${cls}">${sign}${money(t.amount)}</span></button></li>`;
}
function sortTx(a,b){return a.date<b.date?1:a.date>b.date?-1:(b.ts||0)-(a.ts||0)}
function txRow(t){
  let ic='💵',t1='',t2='',amt='',cls='';
  if(t.type==='expense'){const c=catById(t.catId);const b=bucketById(t.bucketId);ic=c?c.emoji:'🧾';t1=c?c.name:'已刪除分類';t2=`<span class="dot" style="background:${b?b.color:'#999'}"></span>${esc(b?b.name:'—')}${t.note?'｜'+esc(t.note):''}`;amt='−'+money(t.amount)}
  else if(t.type==='income'){t1=t.note||'收入';t2=(t.mode==='one'?'全部放入・':'依計畫・')+Object.entries(incAlloc(t)).filter(([,v])=>v).map(([k,v])=>`${esc(nameOf(k))} ${money(v)}`).join('、');amt='+'+money(t.amount);cls='in'}
  else{ic='🔁';t1=`${nameOf(t.from)} → ${nameOf(t.to)}`;t2=t.note?esc(t.note):'罐子間轉移';amt=money(t.amount)}
  return `<li class="swipe">${delAct('p:'+t.id)}<button class="tx" data-action="tx" data-id="${t.id}"><span class="ic">${ic}</span><span class="mid"><div class="t1">${esc(t1)}</div><div class="t2">${t2}</div></span><span class="amt num ${cls}">${amt}</span></button></li>`;
}
const CAT_COLORS=['#1F7A80','#D29A17','#8A4F7D','#3D6FB6','#5C8A3A','#C25B3A'];
// slices for the pie: 'all' = spending per jar (my share for shared jars); a jar = spending per category
function pieData(){
  const m=listMonth,me=myUid();let slices=[],note='',kind;
  if(listBucket==='all'){
    kind='jar';
    for(const b of S.buckets){const v=S.txns.filter(t=>t.type==='expense'&&t.bucketId===b.id&&t.date.slice(0,7)===m).reduce((a,t)=>a+t.amount,0);
      if(v)slices.push({key:b.id,name:b.name,color:b.color,value:v})}
    for(const j of jarsList()){const v=jarShare(j.id,m);if(v)slices.push({key:SJ+j.id,name:j.name+'（你的份額）',color:j.color,value:v})}
    const toJar=S.buckets.reduce((a,b)=>a+((stats(null,m)[b.id]||{}).monthJar||0),0);
    if(toJar)note=`另撥到共用罐 ${money(toJar)}，不計入圖表`;
  }else{
    kind='cat';const g={};
    if(isSJ(listBucket)){
      for(const t of (Cloud.jarTxns[sjId(listBucket)]||[]))if(t.kind==='expense'&&t.date.slice(0,7)===m){
        const k=t.catKey||t.catName||'?';(g[k]=g[k]||{key:k,name:t.catName||'支出',emoji:t.emoji||'🧾',value:0,count:0});g[k].value+=t.amount;g[k].count++}
    }else{
      for(const t of S.txns)if(t.type==='expense'&&t.bucketId===listBucket&&t.date.slice(0,7)===m){
        const c=catById(t.catId),k=t.catId||'?';(g[k]=g[k]||{key:k,name:c?c.name:'已刪除分類',emoji:c?c.emoji:'🧾',value:0,count:0});g[k].value+=t.amount;g[k].count++}
      const mj=(stats(null,m)[listBucket]||{}).monthJar||0;
      if(mj)note=`另撥到共用罐 ${money(mj)}，不計入圖表`;
    }
    slices=Object.values(g);
  }
  slices.sort((a,b)=>b.value-a.value);
  if(slices.length>6){const rest=slices.slice(5);slices=slices.slice(0,5).concat([{key:null,name:`其他 ${rest.length} 項`,value:rest.reduce((a,s)=>a+s.value,0),count:rest.reduce((a,s)=>a+(s.count||0),0),other:true}])}
  slices.forEach((s,i)=>{if(!s.color)s.color=s.other?'#9AA5B1':CAT_COLORS[i%CAT_COLORS.length]});
  return {kind,slices,note,total:slices.reduce((a,s)=>a+s.value,0)};
}
let pieAngle=0,pieSpin=null,pieRAF=0;
function setPieAngle(a){pieAngle=((a%360)+360)%360;const g=document.getElementById('pieRing');if(g)g.setAttribute('transform',`rotate(${pieAngle} 60 60)`)}
function stopPieSpin(){if(pieRAF)cancelAnimationFrame(pieRAF);pieRAF=0}
function resetPie(){stopPieSpin();pieAngle=0}
(function(){
  const ang=(e,r)=>Math.atan2(e.clientY-(r.top+r.height/2),e.clientX-(r.left+r.width/2))*180/Math.PI;
  document.addEventListener('pointerdown',e=>{
    const svg=e.target.closest('#pieSvg');if(!svg||motionPref()==='off')return;
    stopPieSpin();
    const r=svg.getBoundingClientRect();
    pieSpin={r,last:ang(e,r),moved:0,v:0,t:performance.now()};
  });
  document.addEventListener('pointermove',e=>{
    if(!pieSpin)return;
    let a=ang(e,pieSpin.r),da=a-pieSpin.last;
    if(da>180)da-=360;if(da<-180)da+=360;
    const now=performance.now(),dt=Math.max(1,now-pieSpin.t);
    pieSpin.v=pieSpin.v*0.6+(da/dt)*0.4;pieSpin.last=a;pieSpin.t=now;pieSpin.moved+=Math.abs(da);
    if(pieSpin.moved>6)setPieAngle(pieAngle+da);
  });
  const end=()=>{
    if(!pieSpin)return;
    const s=pieSpin;pieSpin=null;
    if(s.moved<=6)return; // a tap: let the slice click through
    suppressClick=true;setTimeout(()=>suppressClick=false,400);
    if(motionPref()!=='standard'||performance.now()-s.t>80)return;
    let v=Math.max(-2.5,Math.min(2.5,s.v)),prev=performance.now();
    const step=now=>{
      const dt=Math.min(50,now-prev);prev=now;
      v*=Math.pow(0.9965,dt);setPieAngle(pieAngle+v*dt);
      if(Math.abs(v)>0.005&&document.getElementById('pieRing'))pieRAF=requestAnimationFrame(step);else pieRAF=0;
    };
    pieRAF=requestAnimationFrame(step);
  };
  document.addEventListener('pointerup',end);
  document.addEventListener('pointercancel',()=>{pieSpin=null});
})();
function pieHtml(){
  const {kind,slices,note,total}=pieData();
  if(!total)return `<div class="empty" style="padding:18px 0 4px">這個月沒有支出${note?`<div class="pienote">${note}</div>`:''}</div>`;
  const R=46,C=2*Math.PI*R;let acc=0;
  const segs=slices.map(s=>{const len=s.value/total*C,gap=slices.length>1?Math.min(1.2,len/3):0;
    const el=`<circle class="seg ${listCat&&listCat!==s.key?'dim':''}" cx="60" cy="60" r="${R}" fill="none" stroke="${s.color}" stroke-width="18"
      stroke-dasharray="${Math.max(0,len-gap)} ${C}" stroke-dashoffset="${-acc}" ${s.other?'':`data-action="pie" data-key="${esc(s.key)}"`}><title>${esc(s.name)} ${money(s.value)}</title></circle>`;
    acc+=len;return el}).join('');
  const legend=slices.map(s=>{const pct=Math.round(s.value/total*100);
    return `<button class="lg" ${s.other?'disabled':`data-action="pie" data-key="${esc(s.key)}"`} aria-pressed="${!!listCat&&listCat===s.key}">
      <span class="sw" style="background:${s.color}"></span><span class="nm">${s.emoji?esc(s.emoji)+' ':''}${esc(s.name)}</span>
      <span class="vl num">${money(s.value)}<small>${pct}%${s.count?`・${s.count} 筆`:''}</small></span></button>`}).join('');
  return `<div class="pie"><svg viewBox="0 0 120 120" role="img" aria-label="支出比例圖" id="pieSvg"><g id="pieRing" transform="rotate(${pieAngle} 60 60)"><g transform="rotate(-90 60 60)">${segs}</g></g>
    <text x="60" y="56" text-anchor="middle" font-size="9" fill="var(--muted)">${kind==='jar'?'總支出':'支出'}</text>
    <text x="60" y="71" text-anchor="middle" font-size="${money(total).length>8?10:13}" font-weight="600" fill="var(--ink)" font-family="Sora, sans-serif">${money(total)}</text></svg>
    <div class="legend">${legend}</div></div>${note?`<p class="pienote">${note}</p>`:''}
    ${kind==='jar'?'<p class="pienote">點罐子可以看它的分類比例</p>':''}`;
}
const searchTerms=()=>listQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
const searching=()=>searchTerms().length>0;
function noteMatch(t,terms){const n=(t.note||'').toLowerCase();return terms.every(k=>n.includes(k))}
function listView(){
  const chips=[`<button class="chip" data-action="lb" data-b="all" aria-pressed="${listBucket==='all'}">全部</button>`]
    .concat(shelfIds().map(id=>{if(isSJ(id)){const j=Cloud.jars[sjId(id)];return `<button class="chip" data-action="lb" data-b="${id}" aria-pressed="${listBucket===id}"><span class="dot" style="background:${j.color}"></span>${esc(j.name)}<span class="pill">共用</span></button>`}
      const b=bucketById(id);return `<button class="chip" data-action="lb" data-b="${b.id}" aria-pressed="${listBucket===b.id}"><span class="dot" style="background:${b.color}"></span>${esc(b.name)}</button>`})).join('');
  if(isSJ(listBucket)&&!Cloud.jars[sjId(listBucket)])listBucket='all';
  return `<div style="display:grid;grid-template-columns:1fr;gap:12px">
    <input type="month" id="lm" value="${listMonth}" aria-label="選擇月份">
    <div class="filters">${chips}</div>
    <div class="search"><div class="sbox ${listQuery?'':'empty'}" id="sbox">
        <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input type="text" id="lq" value="${esc(listQuery)}" placeholder="搜尋備註" autocomplete="off" enterkeyhint="search" aria-label="搜尋備註">
        <button class="clr" data-action="qclear" aria-label="清除搜尋">✕</button></div>
      <button class="chip allm" data-action="qall" aria-pressed="${listAllMonths}">所有月份</button></div></div>
    <div id="listResults">${listResultsHtml()}</div>`;
}
function listResultsHtml(){
  const terms=searchTerms(),q=terms.length>0,all=q&&listAllMonths;
  let items=monthItems(all?null:listMonth,listBucket);
  if(listBucket==='all')listCat=null;
  const catOf=t=>t.jid?(t.kind==='expense'?(t.catKey||t.catName||'?'):null):(t.type==='expense'?(t.catId||'?'):null);
  let shown=listCat?items.filter(t=>catOf(t)===listCat):items;
  if(q)shown=shown.filter(t=>noteMatch(t,terms));
  const sys=(!q&&!listCat)?sysItems(listMonth,listBucket):[];
  const covs=(!q&&!listCat)?coverItems(listMonth,listBucket):[];
  let html='',last='',sumOut=0,sumIn=0,shOut=0,shMine=0,toJar=0,sumCov=0;
  for(const t of items){
    if(t.jid){
      if(t.kind==='expense'){shOut+=t.amount;shMine+=myShare(t)}
      else if(isSJ(listBucket)){if(t.kind==='cover')sumCov+=t.amount;else if(jarIn(t))sumIn+=t.amount}
      else if(t.kind==='contrib'&&t.by===myUid())toJar+=t.amount;
      else if(t.kind==='cover'&&t.by===myUid())sumCov+=t.amount;
    }
    else{
      if(t.type==='expense')sumOut+=t.amount;
      if(t.type==='income')sumIn+=listBucket==='all'?t.amount:(incAlloc(t)[listBucket]||0);
    }
  }
  // daily spending: my own expenses, plus my share of shared ones (full amount when viewing a shared jar)
  const spendOf=t=>t.jid?(t.kind==='expense'?(isSJ(listBucket)?t.amount:myShare(t)):0):(t.type==='expense'?t.amount:0);
  const daySpend={};let found=0;
  for(const t of shown){const v=spendOf(t);found+=v;if(v)daySpend[t.date]=(daySpend[t.date]||0)+v}
  for(const t of shown){
    if(t.date!==last){if(last)html+='</ul>';const d=new Date(t.date+'T00:00');const ds=daySpend[t.date];
      const yr=all?d.getFullYear()+'年':'';
      html+=`<div class="day"><span>${yr}${d.getMonth()+1}月${d.getDate()}日 週${'日一二三四五六'[d.getDay()]}</span>${ds?`<span class="dsum num">支出 ${money(ds)}</span>`:''}</div><ul class="txs">`;last=t.date}
    html+=rowOf(t);
  }
  if(last)html+='</ul>';
  let catLabel='';
  if(listCat){const s=(pieData().slices.find(s=>s.key===listCat)||{});const c=resolveCat(listCat);catLabel=s.name||(c&&c.name)||'這個分類'}
  const totalLine=q
    ?`<div class="total"><span>${all?'所有月份':'這個月'}</span><span class="num" style="text-align:right">找到 <b>${shown.length}</b> 筆　支出 <b>${money(found)}</b></span></div>`
    :`<div class="total"><span>這個月</span><span class="num" style="text-align:right">${isSJ(listBucket)
      ?`共用支出 <b>${money(shOut)}</b>（你的份額 ${money(shMine)}）<br>撥入 <b>${money(sumIn)}</b>${sumCov?`・超支墊付 <b>${money(sumCov)}</b>`:''}`
      :`個人支出 <b>${money(sumOut)}</b>　收入 <b>${money(sumIn)}</b>${toJar?`<br>撥到共用罐 ${money(toJar)}`:''}${sumCov?`<br>替共用罐墊付 ${money(sumCov)}`:''}${shOut?`<br>共用支出 ${money(shOut)}（你的份額 <b>${money(shMine)}</b>）`:''}`}</span></div>`;
  const empty=q?`<div class="empty">${all?'所有月份':'這個月'}沒有符合「${esc(listQuery.trim())}」的紀錄。${all?'':'<br>可以切換到「所有月份」試試看。'}</div>`:'<div class="empty">這個月還沒有紀錄。</div>';
  return `${settleHtml(sys)}${coverHtml(covs)}${totalLine}
    ${q?'':pieHtml()}
    ${listCat?`<button class="catfilter" data-action="pie" data-key="${esc(listCat)}">只看：${esc(catLabel)}　✕</button>`:''}
    ${html||empty}`;
}
// mark search terms inside the rendered rows (text only, never inside tags)
function highlightTerms(root){
  const terms=searchTerms();if(!terms.length||!root)return;
  const re=new RegExp('('+terms.map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')','gi');
  root.querySelectorAll('.tx .t1, .tx .t2').forEach(el=>{
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(n=>{if(!re.test(n.nodeValue))return;re.lastIndex=0;
      const span=document.createElement('span');span.innerHTML=esc(n.nodeValue).replace(re,'<mark>$1</mark>');n.replaceWith(...span.childNodes)});
  });
}
function refreshResults(){const r=document.getElementById('listResults');if(r){r.innerHTML=listResultsHtml();highlightTerms(r)}}
