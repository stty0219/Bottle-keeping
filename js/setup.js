// 分配模式切換、舊資料轉換、防止縮放、動態效果設定
function setAllocMode(m){
  if(S.allocMode===m||(m==='pct'&&!S.allocMode))return;
  let filled=false;
  if(m==='amount'&&planSum()===0){ // first switch: suggest amounts from the latest month's income
    const pt=planTotals(),mk=Object.keys(pt).sort().pop(),T=mk?pt[mk]:0;
    const tot=targets().reduce((a,b)=>a+b.pct,0)||1;
    if(T>0){S.buckets.forEach(b=>b.amt=Math.round(T*(+b.pct||0)/tot/100)*100);filled=true}
    if(!bucketById(S.remainderId))S.remainderId=(S.buckets.find(b=>/彈性/.test(b.name))||S.buckets[S.buckets.length-1]).id;
  }
  S.allocMode=m;persist();render();
  if(filled)toast('已依最近一個月的收入先填入建議金額，可以再調整');
}
function migrate(){
  for(const t of S.txns){
    if(t.type!=='income'||t.mode)continue;
    const ks=Object.keys(t.alloc||{}).filter(k=>t.alloc[k]);
    const active=S.buckets.filter(b=>+b.pct>0).length;
    if(ks.length===1&&active>1){t.mode='one';t.target=ks[0]}else t.mode='pct';
    delete t.alloc;
  }
}
// iPhone Safari ignores user-scalable=no for pinch, so block the pinch gesture itself
['gesturestart','gesturechange','gestureend'].forEach(t=>document.addEventListener(t,e=>e.preventDefault(),{passive:false}));
document.addEventListener('touchmove',e=>{if(e.touches&&e.touches.length>1)e.preventDefault()},{passive:false});
const MOTION_KEY='fenguan-motion';
function motionPref(){
  try{const v=localStorage.getItem(MOTION_KEY);if(v)return v}catch(e){}
  return window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches?'reduce':'standard';
}
function applyMotion(){document.documentElement.dataset.motion=motionPref()}
applyMotion();
