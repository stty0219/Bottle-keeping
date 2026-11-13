// 罐子順序：總覽長按罐子拖拉、設定頁按住 ≡ 拖拉。順序存在帳本的 shelfOrder（含共用罐），個人罐子的 S.buckets 也照同樣順序排列
function shelfIds(){ // full overview order: personal jar ids and 'sj:<jarId>'
  const have=new Set([...S.buckets.map(b=>b.id),...Object.keys(Cloud.jars).map(id=>SJ+id)]);
  const out=(S.shelfOrder||[]).filter(id=>have.has(id)),seen=new Set(out);
  for(const b of S.buckets)if(!seen.has(b.id)){out.push(b.id);seen.add(b.id)}                 // new personal jars go last
  for(const id of Object.keys(Cloud.jars).sort((a,b)=>(Cloud.jars[a].name||'').localeCompare(Cloud.jars[b].name||'')))
    if(!seen.has(SJ+id)){out.push(SJ+id);seen.add(SJ+id)}                                     // newly joined shared jars go last
  return out;
}
function shelfPos(){const p={};shelfIds().forEach((id,i)=>p[id]=i);return p}
function applyShelf(ids){
  if(S.buckets.length){ // pin excessTo / sweepTo before reordering (their fallback depends on the order)
    if(!bucketById(S.excessTo))S.excessTo=excessBucket().id;
    if(!bucketById(S.sweepTo))S.sweepTo=sweepBucket().id;
  }
  S.shelfOrder=ids.slice();
  const pos={};ids.forEach((id,i)=>pos[id]=i);
  S.buckets.sort((a,b)=>(pos[a.id]??1e9)-(pos[b.id]??1e9));
  persist();render();
}
function applyBucketOrder(bids){ // settings only reorders personal jars; shared jars keep their places
  let k=0;applyShelf(shelfIds().map(id=>isSJ(id)?id:bids[k++]));
}

/* drag engine: o = {el, items, axis:'x'|'y', scroller (element or window), x, y, onDrop(from,to)} */
let sortState=null;
document.addEventListener('touchmove',e=>{if(sortState)e.preventDefault()},{passive:false});
function startSort(o){
  const ax=o.axis==='x',items=o.items,from=items.indexOf(o.el);if(from<0)return;
  const scrollOf=()=>o.scroller===window?(ax?window.scrollX:window.scrollY):(ax?o.scroller.scrollLeft:o.scroller.scrollTop);
  const s0=scrollOf(),rects=items.map(n=>n.getBoundingClientRect());
  const startOf=r=>ax?r.left:r.top,ext=r=>ax?r.width:r.height;
  const centers=rects.map(r=>startOf(r)+ext(r)/2+s0);
  const me=rects[from],nb=rects[from+1]||rects[from-1];
  const gap=nb?(rects[from+1]?startOf(rects[from+1])-(startOf(me)+ext(me)):startOf(me)-(startOf(rects[from-1])+ext(rects[from-1]))):0;
  const step=ext(me)+Math.max(0,gap);
  sortState={o,ax,items,from,to:from,p0:ax?o.x:o.y,p:ax?o.x:o.y,s0,scrollOf,centers,step,raf:0};
  o.el.classList.add('lifted');items.forEach(n=>n.classList.add('sortitem'));
  (o.container||o.el.parentNode).classList.add('sorting');
  if(navigator.vibrate)try{navigator.vibrate(12)}catch(_){}
  sortFrame();
}
function sortLayout(){
  const st=sortState;if(!st)return;
  const d=st.p-st.p0+(st.scrollOf()-st.s0),c=st.centers[st.from]+d;
  let to=0;st.centers.forEach((cc,i)=>{if(i!==st.from&&cc<c)to++});st.to=to;
  st.items.forEach((n,i)=>{
    if(i===st.from){n.style.transform=(st.ax?`translateX(${d}px)`:`translateY(${d}px)`)+' scale(1.05)';return}
    const sh=(st.from<i&&i<=to)?-st.step:(to<=i&&i<st.from)?st.step:0;
    n.style.transform=sh?(st.ax?`translateX(${sh}px)`:`translateY(${sh}px)`):'';
  });
}
function sortFrame(){ // auto-scroll near the edges while dragging
  const st=sortState;if(!st)return;
  const sc=st.o.scroller,edge=48,sp=9;
  if(sc===window){const y=st.p;if(y<edge+40)window.scrollBy(0,-sp);else if(y>window.innerHeight-edge-70)window.scrollBy(0,sp)}
  else{const r=sc.getBoundingClientRect();if(st.p<r.left+edge)sc.scrollLeft-=sp;else if(st.p>r.right-edge)sc.scrollLeft+=sp}
  sortLayout();st.raf=requestAnimationFrame(sortFrame);
}
function endSort(cancel){
  const st=sortState;if(!st)return;sortState=null;cancelAnimationFrame(st.raf);
  st.items.forEach(n=>{n.style.transform='';n.classList.remove('sortitem','lifted')});
  (st.o.container||st.o.el.parentNode).classList.remove('sorting');
  suppressClick=true;setTimeout(()=>suppressClick=false,400);
  if(!cancel&&st.to!==st.from)st.o.onDrop(st.from,st.to);
}
const moved=(arr,from,to)=>{const a=arr.slice();a.splice(to,0,a.splice(from,1)[0]);return a};
document.addEventListener('pointermove',e=>{if(sortState){sortState.p=sortState.ax?e.clientX:e.clientY;sortLayout()}});
document.addEventListener('pointerup',()=>endSort(false));
document.addEventListener('pointercancel',()=>endSort(false));

// overview: long-press a jar (about half a second) to pick it up
let pressT=null,pressP=null;
document.addEventListener('pointerdown',e=>{
  const col=e.target.closest('.shelf .jarcol');if(!col||e.button>0)return;
  pressP={x:e.clientX,y:e.clientY,col,id:e.pointerId};clearTimeout(pressT);
  pressT=setTimeout(()=>{
    const p=pressP;pressP=null;if(!p)return;
    const shelf=p.col.parentNode,items=[...shelf.querySelectorAll('.jarcol')];
    try{p.col.setPointerCapture(p.id)}catch(_){}
    startSort({el:p.col,items,axis:'x',scroller:shelf,container:shelf,x:p.x,y:p.y,onDrop:(f,t)=>applyShelf(moved(items.map(n=>n.dataset.bucket),f,t))});
  },450);
});
document.addEventListener('pointermove',e=>{if(pressP&&Math.hypot(e.clientX-pressP.x,e.clientY-pressP.y)>8){clearTimeout(pressT);pressP=null}});
document.addEventListener('pointerup',()=>{clearTimeout(pressT);pressP=null});
document.addEventListener('pointercancel',()=>{clearTimeout(pressT);pressP=null});
document.addEventListener('contextmenu',e=>{if(e.target.closest('.shelf .jarcol'))e.preventDefault()});

// settings: drag the ≡ handle
document.addEventListener('pointerdown',e=>{
  const h=e.target.closest('[data-drag="bucket"]');if(!h||e.button>0)return;
  e.preventDefault();
  const row=h.closest('.set-item'),list=document.getElementById('bucketList');if(!row||!list)return;
  const items=[...list.querySelectorAll('.set-item.brow')];
  try{h.setPointerCapture(e.pointerId)}catch(_){}
  startSort({el:row,items,axis:'y',scroller:window,container:list,x:e.clientX,y:e.clientY,onDrop:(f,t)=>applyBucketOrder(moved(items.map(n=>n.dataset.id),f,t))});
});
