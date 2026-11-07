// 底部表單的開關、下拉收合、emoji 面板
/* ---------- sheet ---------- */
let lockY=null,lockDepth=0;
function lockScroll(){ // keep the page behind the sheet still (iPhone ignores overflow:hidden on its own)
  lockDepth++;if(lockY!==null)return;lockY=window.scrollY;
  document.documentElement.classList.add('lock');
  Object.assign(document.body.style,{position:'fixed',top:-lockY+'px',left:'0',right:'0'});
}
function unlockScroll(){
  lockDepth=Math.max(0,lockDepth-1);if(lockY===null||lockDepth>0)return;
  document.documentElement.classList.remove('lock');
  Object.assign(document.body.style,{position:'',top:'',left:'',right:''});
  window.scrollTo(0,lockY);lockY=null;
}
function openSheet(html){
  const sh=document.getElementById('sheet'),sc=document.getElementById('scrim');
  document.getElementById('sheetBody').innerHTML=html;
  sh.style.transition='';sh.style.transform='';sc.style.opacity='';
  sh.classList.toggle('haskp',!!document.getElementById('kp'));sh.classList.remove('kp-hide');
  sc.classList.add('open');sh.classList.add('open');sh.scrollTop=0;lockScroll();
}
/* ---------- emoji picker ---------- */
const EMOJI_GROUPS=[
  ['餐飲','🍱 🍜 🍔 🍕 🍣 🍙 🥗 🍝 🥟 🍳 🥐 🍰 🍩 ☕ 🧋 🍺 🍷 🥤 🍎 🛒'],
  ['交通','🚌 🚇 🚆 🚕 🚗 🛵 🚲 ⛽ 🅿️ ✈️ 🚄 ⛴️ 🛣️ 🧳'],
  ['居家','🏠 🔑 🛋️ 🛏️ 🧺 🧹 🧼 🪴 💡 🔌 💧 🔥 📶 📱 🧾 📦'],
  ['購物','🛍️ 👕 👖 👗 👟 👜 💄 🧴 🎁 💍 🕶️ ⌚ 💻 🎧 📷 🧸'],
  ['娛樂','🎬 🎮 🎤 🎵 🎨 📚 🎲 🏀 ⚽ 🏸 🏊 🎳 🎟️ 🏕️ 🎡 🧩'],
  ['健康','💊 🏥 🩺 🦷 👓 🧘 💪 🏃 💆 ✂️ 🧖 🩹'],
  ['家人與寵物','👶 🧒 👪 🐶 🐱 🐾 💐 🎂 🎉 💌 🙏 🎓 📖 ✏️'],
  ['金融','💰 💵 💳 🏦 📈 📉 🪙 💹 🧮 🛡️ 📊 💸 🏧'],
  ['其他','🏷️ ⭐ ❤️ 📌 🔔 🗓️ 🌱 ☀️ 🌧️ 🎄 🧧 🎃 ❓']
].map(([n,s])=>[n,s.split(' ')]);
let emoTarget=null; // {id, jid?}
function emoTargetCat(){
  if(!emoTarget)return null;
  if(emoTarget.jid){const j=Cloud.jars[emoTarget.jid];return j&&(j.categories||[]).find(c=>c.id===emoTarget.id)||null}
  return catById(emoTarget.id);
}
function openEmoji(id,jid){
  emoTarget={id,jid:jid||null};const c=emoTargetCat();if(!c)return;
  const cur=c.emoji;
  const groups=EMOJI_GROUPS.map(([n,list])=>`<div class="emogrp">${n}</div><div class="emogrid">${list.map(e=>`<button data-action="emoset" data-e="${e}" aria-pressed="${e===cur}" aria-label="${e}">${e}</button>`).join('')}</div>`).join('');
  openSheet(`<div class="emocur"><span>${esc(cur)}</span>選擇「${esc(c.name)}」的圖示</div>${groups}
    <div class="emogrp">清單裡沒有？</div>
    <div class="emocustom"><input type="text" id="emocustom" placeholder="用 emoji 鍵盤輸入一個" autocomplete="off" aria-label="自訂 emoji"><button class="gbtn" data-action="emocustom">使用</button></div>
    <p class="note" style="margin:6px 0 0">只會保留最後輸入的一個 emoji，文字會被忽略。</p>`);
}
// keep only the last emoji typed (handles flags, skin tones and joined emoji as one character)
function lastEmoji(str){
  const parts=typeof Intl!=='undefined'&&Intl.Segmenter?[...new Intl.Segmenter('zh',{granularity:'grapheme'}).segment(str)].map(s=>s.segment):Array.from(str);
  const em=parts.filter(g=>/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g));
  return em.length?em[em.length-1]:'';
}
function applyEmoji(e){
  const c=emoTargetCat();
  if(!c||!e){closeSheet();return} // nothing chosen: keep the existing emoji
  c.emoji=e;
  if(emoTarget.jid)saveJarMeta(emoTarget.jid,['categories']);else persist();
  emoTarget=null;closeSheet();render();
}
function closeSheet(){
  const sh=document.getElementById('sheet'),sc=document.getElementById('scrim');
  sh.style.transition='';sh.style.transform='';sc.style.opacity='';
  sc.classList.remove('open');sh.classList.remove('open');draft=null;emoTarget=null;colorTarget=null;unlockScroll();
}
/* drag the top of the sheet down to dismiss */
(function(){
  const sh=()=>document.getElementById('sheet'),sc=()=>document.getElementById('scrim');
  let d=null;
  document.addEventListener('pointerdown',e=>{
    if(!e.target.closest('#sheetHandle')||!sh().classList.contains('open'))return;
    d={y0:e.clientY,y:e.clientY,t:performance.now(),v:0,h:sh().offsetHeight};
    sh().style.transition='none';
    try{e.target.setPointerCapture(e.pointerId)}catch(_){}
  });
  document.addEventListener('pointermove',e=>{
    if(!d)return;
    const now=performance.now(),dt=Math.max(1,now-d.t);
    d.v=(e.clientY-d.y)/dt;d.y=e.clientY;d.t=now;
    const dy=Math.max(0,e.clientY-d.y0);
    sh().style.transform=`translateY(${dy}px)`;
    sc().style.opacity=String(Math.max(0,1-dy/d.h));
  });
  const end=()=>{
    if(!d)return;
    const dy=Math.max(0,d.y-d.y0),flick=d.v>0.6&&dy>20;
    sh().style.transition='';
    if(dy>d.h*0.25||flick)closeSheet();
    else{sh().style.transform='';sc().style.opacity=''}
    d=null;
  };
  document.addEventListener('pointerup',end);
  document.addEventListener('pointercancel',end);
})();
