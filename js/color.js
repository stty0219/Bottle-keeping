// 罐子顏色：推薦色、最近使用、手機原生色盤；並依底色深淺自動決定罐子上的文字顏色
const JAR_COLORS=['#1F7A80','#2F9E8F','#5C8A3A','#8DB04A','#D29A17','#E07B39','#C25B3A','#C2412D','#D35D7A',
  '#B04E9A','#8A4F7D','#6C5BB5','#3D6FB6','#2E8BC0','#4A6572','#6B6F7A','#8C6A4F','#2B2D42'];
const RECENT_COLOR_KEY='fenguan-colors';
function textOn(hex){ // readable text colour on top of a fill
  const m=/^#?([0-9a-f]{6})$/i.exec(hex||'');if(!m)return '';
  const n=parseInt(m[1],16),c=[n>>16,(n>>8)&255,n&255].map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});
  return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]>0.36?'#16202B':'#FFFFFF';
}
function recentColors(){try{return (JSON.parse(localStorage.getItem(RECENT_COLOR_KEY))||[]).filter(c=>/^#[0-9a-f]{6}$/i.test(c))}catch(e){return []}}
function rememberColor(c){if(JAR_COLORS.includes(c))return;try{localStorage.setItem(RECENT_COLOR_KEY,JSON.stringify([c,...recentColors().filter(x=>x!==c)].slice(0,8)))}catch(e){}}
let colorTarget=null; // {id} personal jar or {jid} shared jar
function colorTargetObj(){if(!colorTarget)return null;return colorTarget.jid?Cloud.jars[colorTarget.jid]:bucketById(colorTarget.id)}
function colorPreview(c){
  return `<div class="jar mini"><div class="fill" style="height:62%;background:${c}"></div><div class="jarpct num" style="color:${textOn(c)}">62%</div></div>`;
}
function openColor(id,jid){
  colorTarget=jid?{jid}:{id};const o=colorTargetObj();if(!o)return;
  const cur=(o.color||'').toUpperCase(),btn=c=>`<button data-action="cset" data-c="${c}" style="background:${c}" aria-pressed="${c.toUpperCase()===cur}" aria-label="${c}"></button>`;
  const rec=recentColors();
  openSheet(`<div class="cprev"><span id="cprev">${colorPreview(o.color)}</span><div><b>${esc(o.name)}</b><div class="note num" id="chex">${esc(cur)}</div></div></div>
    <div class="emogrp">推薦顏色</div><div class="cgrid">${JAR_COLORS.map(btn).join('')}</div>
    ${rec.length?`<div class="emogrp">最近使用</div><div class="cgrid">${rec.map(btn).join('')}</div>`:''}
    <label class="ghost ccustom">🎨 自訂…<input type="color" value="${/^#[0-9a-f]{6}$/i.test(o.color||'')?o.color:'#1F7A80'}" data-edit="colorpick" aria-label="自訂顏色"></label>`);
}
function previewColor(c){const p=document.getElementById('cprev'),h=document.getElementById('chex');if(p)p.innerHTML=colorPreview(c);if(h)h.textContent=c.toUpperCase()}
function applyColor(c,custom){
  const o=colorTargetObj();if(!o||!/^#[0-9a-f]{6}$/i.test(c)){closeSheet();return}
  o.color=c;if(custom)rememberColor(c);
  if(colorTarget.jid){ // write right away (not debounced) so an incoming snapshot can't bring back the old colour
    if(cloudOn())Cloud.fs.collection('jars').doc(colorTarget.jid).update({color:c,updatedAt:FV().serverTimestamp()}).catch(e=>toast('共用罐沒有存到雲端：'+(e.code||'')));
  }else persist();
  colorTarget=null;closeSheet();render();
}
