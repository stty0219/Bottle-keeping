// 提示訊息（含復原）與左滑刪除
let tt=null,undoFn=null;
function toast(m,undo){
  const el=document.getElementById('toast');undoFn=undo||null;
  el.innerHTML=esc(m)+(undo?'<button class="undo" data-action="undo">復原</button>':'');
  el.classList.toggle('act',!!undo);el.classList.add('show');
  clearTimeout(tt);tt=setTimeout(()=>{el.classList.remove('show','act');undoFn=null},undo?4500:1600);
}

/* swipe left on a record to delete it */
const DELW=84;let sw=null,openLi=null,suppressClick=false;
function setX(li,x,anim){const b=li.querySelector('.tx');b.style.transition=anim?'':'none';b.style.transform=x?`translateX(${x}px)`:''}
function closeSwipe(){if(openLi){setX(openLi,0,true);openLi=null}}
document.addEventListener('pointerdown',e=>{
  const li=e.target.closest('li.swipe');
  if(openLi&&li!==openLi){closeSwipe();suppressClick=true;setTimeout(()=>suppressClick=false,400)}
  if(!li||e.target.closest('.del-act'))return;
  sw={li,x0:e.clientX,y0:e.clientY,dx:0,dir:null,base:li===openLi?-DELW:0};
},{passive:true});
document.addEventListener('pointermove',e=>{
  if(!sw)return;
  const dx=e.clientX-sw.x0,dy=e.clientY-sw.y0;
  if(!sw.dir){if(Math.abs(dx)<8&&Math.abs(dy)<8)return;sw.dir=Math.abs(dx)>Math.abs(dy)?'h':'v'}
  if(sw.dir!=='h')return;
  sw.dx=dx;setX(sw.li,Math.min(0,Math.max(-DELW*1.4,sw.base+dx)),false);
},{passive:true});
function endSwipe(){
  if(!sw)return;
  if(sw.dir==='h'){
    const x=sw.base+sw.dx;
    if(x<-DELW/2){setX(sw.li,-DELW,true);openLi=sw.li}else{setX(sw.li,0,true);if(openLi===sw.li)openLi=null}
    suppressClick=true;setTimeout(()=>suppressClick=false,400);
  }
  sw=null;
}
document.addEventListener('pointerup',endSwipe);
document.addEventListener('pointercancel',()=>{if(sw&&sw.dir==='h'){setX(sw.li,sw.base,true)}sw=null});
document.addEventListener('click',e=>{if(suppressClick&&!e.target.closest('.del-act')){e.preventDefault();e.stopPropagation();suppressClick=false}},true);

function swipeDelete(ref){
  openLi=null;
  if(ref.startsWith('p:')){
    const id=ref.slice(2),t=S.txns.find(x=>x.id===id);if(!t)return;
    const copy=JSON.parse(JSON.stringify(t));
    removeTxn(id);render();
    toast('已刪除',()=>{putTxn(copy);render();toast('已復原')});
  }else{
    const [,jid,id]=ref.split(':');const t=(Cloud.jarTxns[jid]||[]).find(x=>x.id===id);if(!t||!cloudOn())return;
    const {id:_i,jid:_j,...data}=t;
    jarTxnRef(jid,id).delete().catch(()=>toast('刪除失敗'));
    Cloud.jarTxns[jid]=Cloud.jarTxns[jid].filter(x=>x.id!==id);render();
    toast('已刪除',()=>{jarTxnRef(jid,id).set(data).then(()=>toast('已復原')).catch(()=>toast('復原失敗'))});
  }
}
