// 計算邏輯：計畫分配、共用罐撥款、結轉與月底結算
/* ---------- calculations ---------- */
const bucketById=id=>S.buckets.find(b=>b.id===id);
const catById=id=>S.categories.find(c=>c.id===id);
const SJ='sj:';
const isSJ=id=>typeof id==='string'&&id.startsWith(SJ);
const sjId=id=>id.slice(SJ.length);
const jarActive=(jp,mk)=>!!jp&&(!jp.from||mk>=jp.from)&&(!jp.until||mk<jp.until);
function targets(mk){return S.buckets.map(b=>({id:b.id,pct:+b.pct||0,amt:+b.amt||0}))}
// my contribution plan for a shared jar: hist = [{m:'YYYY-MM', amt, src, coverBy}] — each entry applies from its month on
// src: the personal jar this shared jar belongs to (所屬罐子); the monthly contribution comes from it.
// coverBy: the jar that covers my share when the shared jar overspends. v36+: always the same as src
// (entries before v36 may differ or be null; they keep applying to their own past months)
function defaultSrc(){const b=S.buckets.find(b=>/日常/.test(b.name))||S.buckets.find(b=>!isPinned(b))||S.buckets[0];return b?b.id:null}
function jarEff(jp,mk){if(!jp||!jp.hist)return null;let e=null;for(const x of jp.hist)if(x.m<=mk)e=x;return e}
function jarContrib(jp,mk){ // {amt,src} moved in month mk (up to the furthest month in view)
  if(!jarActive(jp,mk)||mk>horizon())return null;
  const e=jarEff(jp,mk);if(!e||!(+e.amt>0)||!bucketById(e.src))return null;
  return {amt:+e.amt,src:e.src};
}
function jarCoverSrc(jp,mk){ // my jar that covers my share of month mk's overspending, or null
  if(!jarActive(jp,mk)||mk>horizon())return null;
  const e=jarEff(jp,mk);return e&&e.coverBy&&bucketById(e.coverBy)?e.coverBy:null;
}
function setJarPlan(jid,field,val){ // changes take effect from the current month; past months keep their amount
  const jp=(S.jarPlan||{})[jid];if(!jp)return;
  jp.hist=jp.hist||[];const m=curMonth(),last=jp.hist[jp.hist.length-1];
  const base=jarEff(jp,m)||last||{amt:0,src:defaultSrc()},at=(jp.from&&jp.from>m)?jp.from:m;
  // the owner jar pays both the monthly contribution and my share of overspending
  const up=field==='src'?{src:val,coverBy:val}:{[field]:val};
  if(last&&last.m===at)Object.assign(last,up);
  else jp.hist.push(Object.assign({m:at,amt:base.amt,src:base.src,coverBy:base.src},up));
}
function newJarPlan(name){const src=defaultSrc();return {from:curMonth(),hist:[{m:curMonth(),amt:0,src,coverBy:src}],name}}
/* v36: a shared jar belongs to one personal jar (src), which also covers my share of its overspending.
   Once per ledger: from the current month on, coverBy = src. Past months keep what they had, so past balances don't change.
   What changed is kept in jarOwnerNote and shown in the notification panel. */
function migrateJarOwner(){
  if(S.jarOwnerV36||!S.buckets||!S.buckets.length)return false;
  const m=curMonth(),items=[];
  for(const jid in (S.jarPlan||{})){
    const jp=S.jarPlan[jid];if(!jp.hist||!jp.hist.length||(jp.until&&jp.until<=m))continue;
    const e=jarEff(jp,m)||jp.hist[0],own=bucketById(e.src);if(!own)continue;
    const before=e.coverBy||null;
    if(before!==e.src){if(e.m>=m)e.coverBy=e.src;else jp.hist.splice(jp.hist.indexOf(e)+1,0,{m,amt:e.amt,src:e.src,coverBy:e.src})}
    for(const x of jp.hist)if(x.m>m)x.coverBy=x.src;
    if(before!==e.src){
      const nm=(Cloud.jars[jid]||{}).name||jp.name||'共用罐',was=bucketById(before);
      items.push(`「${nm}」超支時你的份額，從這個月起改由「${own.name}」支付（原本${was?`是「${was.name}」`:'不墊付'}）。`);
    }
  }
  S.jarOwnerV36=true;
  if(items.length)S.jarOwnerNote={at:Date.now(),items};
  return true;
}
function migrateJarPlan(){
  let changed=false;
  for(const jid in (S.jarPlan||{})){const jp=S.jarPlan[jid];
    if(!jp.hist){jp.hist=[{m:jp.from||curMonth(),amt:+jp.amt||0,src:defaultSrc()}];delete jp.amt;delete jp.pct;changed=true}}
  return changed;
}
function allocate(amount,mode,target,mk){
  const res={};
  if(mode==='one'){res[target]=amount;return res}
  const ts=targets(mk),tot=ts.reduce((a,b)=>a+b.pct,0)||1;
  let rem=amount;
  ts.forEach((b,i)=>{const v=i===ts.length-1?rem:Math.round(amount*b.pct/tot);res[b.id]=v;rem-=v});
  return res;
}
const isPlan=t=>t.type==='income'&&t.mode!=='one';
let planCache=null;
function planTotals(excludeId){ // month -> total of plan-following income
  if(!excludeId&&planCache)return planCache;
  const m={};
  for(const t of S.txns){if(isPlan(t)&&t.id!==excludeId){const k=t.date.slice(0,7);m[k]=(m[k]||0)+t.amount}}
  if(!excludeId)planCache=m;
  return m;
}
const planSum=mk=>targets(mk).reduce((a,b)=>a+Math.max(0,b.amt),0);
// where income above the plan goes (excessTo) and where reset jars settle at month end (sweepTo); both always carry
function fallbackPin(){const c=S.buckets.filter(b=>b.carry!==false);return c[c.length-1]||S.buckets[S.buckets.length-1]}
function excessBucket(){return bucketById(S.excessTo)||fallbackPin()}
function sweepBucket(){return bucketById(S.sweepTo)||fallbackPin()}
// the jar that covers b's overspending (never itself), or null
function coverOf(b){return b&&b.coverBy&&b.coverBy!==b.id?bucketById(b.coverBy)||null:null}
function migrateCover(){ // v32: the designated jar (remainderId) becomes excessTo + sweepTo + coverBy of every reset jar
  if(!S.buckets||!S.buckets.length)return false;
  let changed=false;
  if(S.excessTo==null&&S.sweepTo==null){
    const r=bucketById(S.remainderId)||S.buckets[S.buckets.length-1];
    S.excessTo=S.sweepTo=r.id;
    for(const b of S.buckets)b.coverBy=b.carry===false&&b.id!==r.id?r.id:null;
    changed=true;
  }
  for(const b of S.buckets)if(b.coverBy&&!coverOf(b)){b.coverBy=null;changed=true}
  if(!bucketById(S.excessTo)){S.excessTo=fallbackPin().id;changed=true}
  if(!bucketById(S.sweepTo)){S.sweepTo=fallbackPin().id;changed=true}
  return changed;
}
function planAlloc(T,mk){ // how one month's plan income is split
  const ts=targets(mk),res={};ts.forEach(b=>res[b.id]=0);
  if(T<=0||!S.buckets.length)return res;
  if(S.allocMode!=='amount')return Object.assign(res,allocate(T,'pct',null,mk));
  const rid=excessBucket().id,P=planSum(mk);
  if(P<=0){res[rid]=T;return res}
  if(T>=P){ts.forEach(b=>res[b.id]=Math.max(0,b.amt));res[rid]+=T-P;return res}
  const bs=ts.filter(b=>b.amt>0);let rem=T;
  bs.forEach((b,i)=>{const v=i===bs.length-1?rem:Math.round(T*b.amt/P);res[b.id]=v;rem-=v});
  return res;
}
function incAlloc(t){ // this income's share of its month
  if(t.mode==='one')return {[t.target]:t.amount};
  const mk=t.date.slice(0,7),T=planTotals()[mk]||t.amount,a=planAlloc(T,mk),r={};
  for(const k in a)r[k]=Math.round(a[k]*t.amount/T);
  return r;
}
const curMonth=()=>today().slice(0,7);
// furthest month in view: the current month, or the latest month you've recorded something in
let horizonCache=null;
function horizon(){if(horizonCache)return horizonCache;return horizonCache=S.txns.reduce((a,t)=>t.date.slice(0,7)>a?t.date.slice(0,7):a,curMonth())}
function shiftMonth(mk,d){const [y,m]=mk.split('-').map(Number);const dt=new Date(y,m-1+d,1);return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')}
const isPinned=b=>!!b&&S.buckets.length>0&&(excessBucket().id===b.id||sweepBucket().id===b.id);
const carries=b=>b.carry!==false||isPinned(b); // excessTo / sweepTo always carry
// balances for one month: open (carried in) + this month's in − out
function stats(excludeId,month){
  month=month||curMonth();
  const per={};S.buckets.forEach(b=>per[b.id]={});
  const add=(id,mk,f,v)=>{const p=per[id];if(!p)return;(p[mk]||(p[mk]={i:0,o:0,j:0,xi:0,xo:0}))[f]+=v};
  // v40: a transfer between two personal jars, on the side of a jar that carries over, belongs to the carried money
  // (xi: in, xo: out) rather than this month's share. Balances are unchanged; only how the month is reported.
  // Old transfers into / out of shared jars keep counting in the month.
  const xfer=(t,id)=>!!per[t.from]&&!!per[t.to]&&carries(bucketById(id));
  for(const t of S.txns){
    if(t.id===excludeId)continue;
    const mk=t.date.slice(0,7);if(mk>month)continue;
    if(t.type==='income'){if(t.mode==='one')add(t.target,mk,'i',t.amount)}
    else if(t.type==='expense')add(t.bucketId,mk,'o',t.amount);
    else if(t.type==='transfer'){add(t.from,mk,'o',t.amount);add(t.to,mk,'i',t.amount);
      if(xfer(t,t.from))add(t.from,mk,'xo',t.amount);if(xfer(t,t.to))add(t.to,mk,'xi',t.amount)}
  }
  const pt=planTotals(excludeId);
  for(const mk in pt){if(mk>month)continue;const a=planAlloc(pt[mk],mk);for(const k in a)if(a[k])add(k,mk,'i',a[k])}
  // money I put into shared jars, per month: {src, id:'sj:<jarId>', contrib, cover} — shown as the source jar's spending
  const jx={},jpart=(mk,src,jid)=>{const l=jx[mk]||(jx[mk]=[]);let p=l.find(x=>x.src===src&&x.id===SJ+jid);if(!p)l.push(p={src,id:SJ+jid,contrib:0,cover:0});return p};
  for(const jid in (S.jarPlan||{})){const jp=S.jarPlan[jid];
    for(let mk=jp.from||month;mk<=month;mk=shiftMonth(mk,1)){const c=jarContrib(jp,mk);if(c){add(c.src,mk,'o',c.amt);add(c.src,mk,'j',c.amt);jpart(mk,c.src,jid).contrib+=c.amt}}}
  // my share of shared-jar overspending: read from the cover records I wrote into the shared jars
  const me=myUid(),jc={};
  if(me)for(const jid in Cloud.jarTxns)for(const t of Cloud.jarTxns[jid]){
    if(t.kind!=='cover'||t.by!==me||t.id===excludeId||!per[t.srcId])continue;
    const mk=t.date.slice(0,7);if(mk>month)continue;
    (jc[mk]||(jc[mk]=[])).push({src:t.srcId,id:SJ+jid,amount:t.amount});
    jpart(mk,t.srcId,jid).cover+=t.amount;
  }
  // walk month by month:
  // 1. balance = carried in + this month's in − out. Money put into shared jars (monthly contribution + my share of
  //    their overspending) is the owner jar's own spending, so it is taken here too
  // 2. a jar with coverBy has its own shortfall (from step 1) covered right away (墊付); not chained — a coverer that
  //    goes negative by covering other personal jars stays negative
  // 3. at month end every reset jar settles what it has left (or lacks) into sweepTo
  const sw=sweepBucket();
  const months=new Set([month,...Object.keys(jc)]);for(const id in per)for(const mk in per[id])months.add(mk);
  const bal={},out={};S.buckets.forEach(b=>bal[b.id]=0);
  let lastSweep=0,lastParts=[],lastMk=null;
  for(const mk of [...months].sort()){
    const isTarget=mk===month,open={},short={},cov={},covBy={};
    for(const b of S.buckets){const cur=per[b.id][mk]||{i:0,o:0,j:0};open[b.id]=bal[b.id];bal[b.id]+=cur.i-cur.o}
    for(const x of (jc[mk]||[]))bal[x.src]-=x.amount; // my share of shared-jar overspending is the owner jar's own spending
    for(const b of S.buckets)short[b.id]=bal[b.id]<0?-bal[b.id]:0;
    for(const b of S.buckets){const c=coverOf(b);
      if(c&&short[b.id]>0){bal[b.id]+=short[b.id];bal[c.id]-=short[b.id];covBy[b.id]=c.id;(cov[c.id]||(cov[c.id]=[])).push({id:b.id,amount:short[b.id]})}}
    if(isTarget){
      for(const b of S.buckets){const cur=per[b.id][mk]||{i:0,o:0,j:0,xi:0,xo:0},parts=cov[b.id]||[];
        const jp=(jx[mk]||[]).filter(p=>p.src===b.id).map(p=>({id:p.id,contrib:p.contrib,cover:p.cover,amount:p.contrib+p.cover}));
        const jcov=jp.reduce((a,p)=>a+p.cover,0);
        // monthIn = this month's share (no transfers into the carried money); monthOut = own spending + transfers out
        // that count in the month (no shared-jar money); jarOut = contribution + cover paid into shared jars.
        // Transfers out of the carried money use max(0,open) + transfers in first; xferShare is what took this month's share
        const xferShare=Math.max(0,cur.xo-(Math.max(0,open[b.id])+cur.xi));
        out[b.id]={open:open[b.id],monthIn:cur.i-cur.xi,monthOut:cur.o-cur.j-cur.xo,xferIn:cur.xi,xferOut:cur.xo,xferShare,monthJar:cur.j,jarCover:jcov,jarOut:cur.j+jcov,jarParts:jp,bal:bal[b.id],sweep:0,short:short[b.id],
          over:covBy[b.id]?short[b.id]:0,coveredBy:covBy[b.id]||null,covered:parts.reduce((a,p)=>a+p.amount,0),coverParts:parts}}
      break;
    }
    let sweep=0;const parts=[];
    for(const b of S.buckets){if(!carries(b)){if(bal[b.id])parts.push({id:b.id,amount:bal[b.id]});sweep+=bal[b.id];bal[b.id]=0}}
    if(sw)bal[sw.id]+=sweep;
    lastSweep=sweep;lastParts=parts;lastMk=mk;
  }
  if(sw&&out[sw.id]){out[sw.id].sweep=lastSweep;out[sw.id].sweepParts=lastParts;out[sw.id].sweepMonth=lastMk}
  return out;
}

const jarIn=t=>t.kind==='contrib'||t.kind==='in'||t.kind==='cover';
function jarStats(jid,month,excludeId){ // shared jars always carry over; monthCover = this month's cover records (part of monthIn)
  month=month||curMonth();let open=0,mi=0,mo=0,mc=0;
  for(const t of (Cloud.jarTxns[jid]||[])){
    if(t.id===excludeId)continue;
    const mk=t.date.slice(0,7);if(mk>month)continue;
    const v=jarIn(t)?t.amount:-t.amount;
    if(mk<month)open+=v;else if(jarIn(t)){mi+=t.amount;if(t.kind==='cover')mc+=t.amount}else mo+=t.amount;
  }
  return {open,monthIn:mi,monthOut:mo,monthCover:mc,bal:open+mi-mo};
}
// overspending that is new in month mk, split evenly by the current member count (every member's device gets the same result)
// B = open (incl. earlier months' covers) + this month's in (excl. covers) − out; new = max(0,−B) − max(0,−open), at least 0
function jarOver(jid,mk){
  const s=jarStats(jid,mk),B=s.bal-s.monthCover;
  const over=Math.max(0,Math.max(0,-B)-Math.max(0,-s.open));
  const mem=(Cloud.jars[jid]||{}).members||[],n=mem.length||1,share=Math.round(over/n),paid={};
  for(const t of (Cloud.jarTxns[jid]||[]))if(t.kind==='cover'&&t.date.slice(0,7)===mk)paid[t.by]=(paid[t.by]||0)+t.amount;
  const unpaid=over?mem.map(u=>({uid:u,amount:Math.max(0,share-(paid[u]||0))})).filter(x=>x.amount>0):[];
  return {over,n,share,paid,unpaid,covered:s.monthCover};
}
// v36: my spending = own expenses + money I put into shared jars (monthly contribution + overspending cover).
// Shared expenses inside a shared jar are not my spending (they are paid with that money).
function ownSpend(month){return S.txns.filter(t=>t.type==='expense'&&t.date.slice(0,7)===month).reduce((a,t)=>a+t.amount,0)}
function sharedSpend(month,st){ // {total, parts:[{id:'sj:<jarId>', contrib, cover, amount}]} in overview order
  st=st||stats(null,month);const by={};let total=0;
  for(const b of S.buckets)for(const p of ((st[b.id]||{}).jarParts||[])){
    const g=by[p.id]||(by[p.id]={id:p.id,contrib:0,cover:0,amount:0});g.contrib+=p.contrib;g.cover+=p.cover;g.amount+=p.amount;total+=p.amount}
  const pos=shelfPos();
  return {total,parts:Object.values(by).filter(p=>p.amount).sort((a,b)=>(pos[a.id]??1e9)-(pos[b.id]??1e9))};
}
function balanceOf(id,month,excludeId){return isSJ(id)?jarStats(sjId(id),month,excludeId).bal:(stats(excludeId,month)[id]||{bal:0}).bal}
