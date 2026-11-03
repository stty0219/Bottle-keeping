// 計算邏輯：計畫分配、共用罐撥款、結轉與月底結算
/* ---------- calculations ---------- */
const bucketById=id=>S.buckets.find(b=>b.id===id);
const catById=id=>S.categories.find(c=>c.id===id);
const SJ='sj:';
const isSJ=id=>typeof id==='string'&&id.startsWith(SJ);
const sjId=id=>id.slice(SJ.length);
const jarActive=(jp,mk)=>!!jp&&(!jp.from||mk>=jp.from)&&(!jp.until||mk<jp.until);
function targets(mk){return S.buckets.map(b=>({id:b.id,pct:+b.pct||0,amt:+b.amt||0}))}
// my contribution plan for a shared jar: hist = [{m:'YYYY-MM', amt, src}] — each entry applies from its month on
function defaultSrc(){const b=S.buckets.find(b=>/日常/.test(b.name))||S.buckets.find(b=>!isRemainder(b))||S.buckets[0];return b?b.id:null}
function jarEff(jp,mk){if(!jp||!jp.hist)return null;let e=null;for(const x of jp.hist)if(x.m<=mk)e=x;return e}
function jarContrib(jp,mk){ // {amt,src} moved in month mk (up to the furthest month in view)
  if(!jarActive(jp,mk)||mk>horizon())return null;
  const e=jarEff(jp,mk);if(!e||!(+e.amt>0)||!bucketById(e.src))return null;
  return {amt:+e.amt,src:e.src};
}
function setJarPlan(jid,field,val){ // changes take effect from the current month; past months keep their amount
  const jp=(S.jarPlan||{})[jid];if(!jp)return;
  jp.hist=jp.hist||[];const m=curMonth(),last=jp.hist[jp.hist.length-1];
  const base=jarEff(jp,m)||{amt:0,src:defaultSrc()};
  if(last&&last.m===m)last[field]=val;
  else jp.hist.push(Object.assign({m:(jp.from&&jp.from>m)?jp.from:m,amt:base.amt,src:base.src},{[field]:val}));
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
function remainderBucket(){return bucketById(S.remainderId)||S.buckets[S.buckets.length-1]}
function planAlloc(T,mk){ // how one month's plan income is split
  const ts=targets(mk),res={};ts.forEach(b=>res[b.id]=0);
  if(T<=0||!S.buckets.length)return res;
  if(S.allocMode!=='amount')return Object.assign(res,allocate(T,'pct',null,mk));
  const rid=remainderBucket().id,P=planSum(mk);
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
const isRemainder=b=>!!b&&remainderBucket()&&remainderBucket().id===b.id;
const carries=b=>b.carry!==false||isRemainder(b); // the designated jar always carries
// balances for one month: open (carried in) + this month's in − out
function stats(excludeId,month){
  month=month||curMonth();
  const per={};S.buckets.forEach(b=>per[b.id]={});
  const add=(id,mk,f,v)=>{const p=per[id];if(!p)return;(p[mk]||(p[mk]={i:0,o:0,j:0}))[f]+=v};
  for(const t of S.txns){
    if(t.id===excludeId)continue;
    const mk=t.date.slice(0,7);if(mk>month)continue;
    if(t.type==='income'){if(t.mode==='one')add(t.target,mk,'i',t.amount)}
    else if(t.type==='expense')add(t.bucketId,mk,'o',t.amount);
    else if(t.type==='transfer'){add(t.from,mk,'o',t.amount);add(t.to,mk,'i',t.amount)}
  }
  const pt=planTotals(excludeId);
  for(const mk in pt){if(mk>month)continue;const a=planAlloc(pt[mk],mk);for(const k in a)if(a[k])add(k,mk,'i',a[k])}
  for(const jid in (S.jarPlan||{})){const jp=S.jarPlan[jid];
    for(let mk=jp.from||month;mk<=month;mk=shiftMonth(mk,1)){const c=jarContrib(jp,mk);if(c){add(c.src,mk,'o',c.amt);add(c.src,mk,'j',c.amt)}}}
  // walk month by month: carrying jars keep their balance; reset jars settle at month end into the designated jar
  const rem=remainderBucket();
  const months=new Set([month]);for(const id in per)for(const mk in per[id])months.add(mk);
  const bal={},out={};S.buckets.forEach(b=>bal[b.id]=0);
  let lastSweep=0,lastParts=[],lastMk=null;
  for(const mk of [...months].sort()){
    const isTarget=mk===month;
    for(const b of S.buckets){
      const cur=per[b.id][mk]||{i:0,o:0,j:0};
      if(isTarget)out[b.id]={open:bal[b.id],monthIn:cur.i,monthOut:cur.o,monthJar:cur.j,bal:bal[b.id]+cur.i-cur.o,sweep:0};
      bal[b.id]+=cur.i-cur.o;
    }
    if(isTarget)break;
    let sweep=0;const parts=[];
    for(const b of S.buckets){if(!carries(b)){if(bal[b.id])parts.push({id:b.id,amount:bal[b.id]});sweep+=bal[b.id];bal[b.id]=0}}
    if(rem)bal[rem.id]+=sweep;
    lastSweep=sweep;lastParts=parts;lastMk=mk;
  }
  if(rem&&out[rem.id]){out[rem.id].sweep=lastSweep;out[rem.id].sweepParts=lastParts;out[rem.id].sweepMonth=lastMk}
  return out;
}

const jarIn=t=>t.kind==='contrib'||t.kind==='in';
function jarStats(jid,month,excludeId){ // shared jars always carry over
  month=month||curMonth();let open=0,mi=0,mo=0;
  for(const t of (Cloud.jarTxns[jid]||[])){
    if(t.id===excludeId)continue;
    const mk=t.date.slice(0,7);if(mk>month)continue;
    const v=jarIn(t)?t.amount:-t.amount;
    if(mk<month)open+=v;else if(jarIn(t))mi+=t.amount;else mo+=t.amount;
  }
  return {open,monthIn:mi,monthOut:mo,bal:open+mi-mo};
}
function balanceOf(id,month,excludeId){return isSJ(id)?jarStats(sjId(id),month,excludeId).bal:(stats(excludeId,month)[id]||{bal:0}).bal}
