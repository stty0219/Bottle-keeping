// 罐子顏色：推薦色、我的顏色（跟著帳本同步，可新增、刪除、排序）、手機原生色盤；並依底色深淺自動決定罐子上的文字顏色
const JAR_COLORS=['#1F7A80','#2F9E8F','#5C8A3A','#8DB04A','#D29A17','#E07B39','#C25B3A','#C2412D','#D35D7A',
  '#B04E9A','#8A4F7D','#6C5BB5','#3D6FB6','#2E8BC0','#4A6572','#6B6F7A','#8C6A4F','#2B2D42'];
const RECENT_COLOR_KEY='fenguan-colors'; // v28 本機的「最近使用」，只用來轉入我的顏色
const MY_COLOR_MAX=16;
const isHex=c=>/^#[0-9a-f]{6}$/i.test(c||'');
function textOn(hex){ // readable text colour on top of a fill
  const m=/^#?([0-9a-f]{6})$/i.exec(hex||'');if(!m)return '';
  const n=parseInt(m[1],16),c=[n>>16,(n>>8)&255,n&255].map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});
  return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]>0.36?'#16202B':'#FFFFFF';
}
function myColors(){return (Array.isArray(S.myColors)?S.myColors:[]).filter(isHex)}
function migrateColors(){ // v29: the ledger has no myColors yet → bring in this device's old recent colours once
  if(Array.isArray(S.myColors))return false;
  let old=[];try{old=JSON.parse(localStorage.getItem(RECENT_COLOR_KEY))||[]}catch(e){}
  const out=[];for(const c of Array.isArray(old)?old:[]){if(!isHex(c))continue;const u=c.toUpperCase();if(!out.includes(u))out.push(u)}
  S.myColors=out.slice(0,MY_COLOR_MAX);
  return S.myColors.length>0;
}

let colorTarget=null; // {id} personal jar or {jid} shared jar
let colorUI={custom:null,edit:false}; // custom: colour picked in the native picker but not applied yet
function colorTargetObj(){if(!colorTarget)return null;return colorTarget.jid?Cloud.jars[colorTarget.jid]:bucketById(colorTarget.id)}
function colorPreview(c){
  return `<div class="jar mini"><div class="fill" style="height:62%;background:${c}"></div><div class="jarpct num" style="color:${textOn(c)}">62%</div></div>`;
}
function colorBtn(c){
  const o=colorTargetObj(),cur=((o&&o.color)||'').toUpperCase();
  return `<button data-action="cset" data-c="${c}" style="background:${c}" aria-pressed="${c.toUpperCase()===cur}" aria-label="${c}"></button>`;
}
function myColorsHTML(){
  const list=myColors();if(!list.length)colorUI.edit=false;
  const ed=colorUI.edit;
  const head=`<div class="cmyhead"><span class="emogrp">我的顏色</span>${list.length?`<button data-action="cedit">${ed?'完成':'編輯'}</button>`:''}</div>`;
  if(!list.length)return head+`<p class="note cempty">用「自訂…」選好顏色後，按「加入我的顏色」就會出現在這裡。</p>`;
  if(!ed)return head+`<div class="cgrid">${list.map(colorBtn).join('')}</div>`;
  return head+`<div class="cmrow" id="cmrow">${list.map(c=>`<div class="citem" data-c="${c}"><span class="csw" style="background:${c}"></span><button class="cx" data-action="cdel" data-c="${c}" aria-label="刪除 ${c}">✕</button></div>`).join('')}</div>
    <p class="note">按住顏色拖拉可以調整順序，點 ✕ 刪除。</p>`;
}
function customActHTML(){
  return colorUI.custom?`<button class="primary" data-action="cuse">使用這個顏色</button><button class="ghost" data-action="cadd">加入我的顏色</button>`:'';
}
function openColor(id,jid){
  colorTarget=jid?{jid}:{id};colorUI={custom:null,edit:false};const o=colorTargetObj();if(!o)return;
  const cur=(o.color||'').toUpperCase();
  openSheet(`<div class="cprev"><span id="cprev">${colorPreview(o.color)}</span><div><b>${esc(o.name)}</b><div class="note num" id="chex">${esc(cur)}</div></div></div>
    <div class="emogrp">推薦顏色</div><div class="cgrid">${JAR_COLORS.map(colorBtn).join('')}</div>
    <div id="mycolors">${myColorsHTML()}</div>
    <label class="ghost ccustom">🎨 自訂…<input type="color" value="${isHex(o.color)?o.color:'#1F7A80'}" data-edit="colorpick" aria-label="自訂顏色"></label>
    <div class="cact" id="cact"></div>`);
}
function renderMyColors(){
  const el=document.getElementById('mycolors');if(!el)return;
  const r=document.getElementById('cmrow'),x=r?r.scrollLeft:0;
  el.innerHTML=myColorsHTML();
  const r2=document.getElementById('cmrow');if(r2)r2.scrollLeft=x;
}
function previewColor(c){ // native picker moved: only preview, never apply (iPhone fires change while still adjusting)
  if(!isHex(c)||!colorTarget)return;
  colorUI.custom=c.toUpperCase();
  const p=document.getElementById('cprev'),h=document.getElementById('chex'),a=document.getElementById('cact');
  if(p)p.innerHTML=colorPreview(colorUI.custom);if(h)h.textContent=colorUI.custom;
  if(a&&!a.innerHTML)a.innerHTML=customActHTML();
}
function addMyColor(){
  const c=colorUI.custom;if(!c)return;
  const list=myColors();
  if(list.includes(c)){toast('這個顏色已經在「我的顏色」裡了');return}
  if(list.length>=MY_COLOR_MAX){toast(`「我的顏色」最多 ${MY_COLOR_MAX} 個，請先刪除不用的顏色`);return}
  S.myColors=[c,...list];persist();renderMyColors();toast('已加入我的顏色');
}
function delMyColor(c){S.myColors=myColors().filter(x=>x!==c);persist();renderMyColors()}
function toggleColorEdit(){colorUI.edit=!colorUI.edit;renderMyColors()}
function applyColor(c){
  const o=colorTargetObj();if(!o||!isHex(c)){closeSheet();return}
  o.color=c;
  if(colorTarget.jid){ // write right away (not debounced) so an incoming snapshot can't bring back the old colour
    if(cloudOn())Cloud.fs.collection('jars').doc(colorTarget.jid).update({color:c,updatedAt:FV().serverTimestamp()}).catch(e=>toast('共用罐沒有存到雲端：'+(e.code||'')));
  }else persist();
  colorTarget=null;closeSheet();render();
}

// 編輯「我的顏色」：按住一下（約 0.3 秒）後左右拖拉排序；直接滑動是捲動
let cPress=null;
document.addEventListener('pointerdown',e=>{
  const it=e.target.closest('#cmrow .citem');if(!it||e.target.closest('.cx')||e.button>0)return;
  const p={x:e.clientX,y:e.clientY,it,id:e.pointerId};
  clearTimeout(cPress&&cPress.t);
  p.t=setTimeout(()=>{
    if(cPress!==p)return;cPress=null;
    const row=document.getElementById('cmrow');if(!row||!row.contains(p.it))return;
    const items=[...row.querySelectorAll('.citem')];
    try{p.it.setPointerCapture(p.id)}catch(_){}
    startSort({el:p.it,items,axis:'x',scroller:row,container:row,x:p.x,y:p.y,
      onDrop:(f,t)=>{S.myColors=moved(items.map(n=>n.dataset.c),f,t);persist();renderMyColors()}});
  },300);
  cPress=p;
});
document.addEventListener('pointermove',e=>{if(cPress&&Math.hypot(e.clientX-cPress.x,e.clientY-cPress.y)>8){clearTimeout(cPress.t);cPress=null}});
const cPressEnd=()=>{if(cPress){clearTimeout(cPress.t);cPress=null}};
document.addEventListener('pointerup',cPressEnd);
document.addEventListener('pointercancel',cPressEnd);
document.addEventListener('contextmenu',e=>{if(e.target.closest('#cmrow .citem'))e.preventDefault()});
