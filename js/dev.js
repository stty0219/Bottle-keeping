// 開發者選項
/* ---------- developer mode ---------- */
const DEV_KEY='fenguan-dev';
function devOn(){try{return localStorage.getItem(DEV_KEY)==='1'}catch(e){return false}}
let verTaps=0,verTimer=null;
function verTap(){
  verTaps++;clearTimeout(verTimer);verTimer=setTimeout(()=>verTaps=0,1500);
  const left=7-verTaps,on=devOn();
  if(left<=0){verTaps=0;try{localStorage.setItem(DEV_KEY,on?'0':'1')}catch(e){}render();toast(on?'已關閉開發者模式':'已開啟開發者模式');return}
  if(left<=3)toast(on?`再點 ${left} 下關閉開發者模式`:`再點 ${left} 下開啟開發者模式`);
}
let devView='home';
const devTop=(back)=>`<div class="sum-top">${back?`<button class="back" data-action="devgo" data-v="${back[0]}">‹ ${back[1]}</button>`:'<span></span>'}<button class="sum-x" data-action="devclose" aria-label="關閉">✕</button></div>`;
function themePreview(id,big){const tx=themeText(id);return `<div class="${big?'tpbig':'tp'} th-${id}"><div class="tpz">${THEMES[id].badge('S',tx.titles.S)}</div></div>`}
function devHtml(){
  if(devView==='rules'){
    const r=gradeRules(),pc=v=>Math.round(v*100);
    const rule=(g,label,sub,key,val,unit,max)=>`<div class="rule"><span class="gd g-${g}">${g}</span><span class="tx2">${label}<small>${sub}</small></span>
      <span class="unitw"><input type="number" inputmode="numeric" min="0" max="${max}" step="1" value="${val}" data-edit="gr" data-k="${key}" aria-label="${label}"><span class="u">${unit}</span></span></div>`;
    return `${devTop(['home','開發者選項'])}<h1>評等條件</h1>
      <p class="note" style="margin:0 0 6px">結餘率 =（收入 − 支出）÷ 收入；支出含共用份額，不含撥到共用罐的錢。只看你自己的罐子。所有結算風格共用這組條件。</p>
      ${rule('S','結餘率至少','且沒有罐子超支','sRate',pc(r.sRate),'%',100)}
      ${rule('A','結餘率至少','且沒有罐子超支','aRate',pc(r.aRate),'%',100)}
      ${rule('B','最多幾個罐子超支','且支出沒有超過收入','bMaxOver',r.bMaxOver,'個',20)}
      <div class="rule"><span class="gd g-C">C</span><span class="tx2">其他情況<small>超支的罐子更多，或支出超過收入</small></span><span></span></div>
      <p class="note" style="margin:8px 0 0">沒有記收入的月份：沒有超支是 A，在 B 的超支上限內是 B，否則是 C。</p>
      <button class="ghost" style="margin-top:12px" data-action="grreset">恢復預設條件</button>`;
  }
  if(devView==='themes'){
    const cur=themeId();
    return `${devTop(['home','開發者選項'])}<h1>結算風格</h1>
      <p class="note" style="margin:0 0 12px">點選風格進入設定，可以預覽、套用，並調整這個風格的稱號和評語。</p>
      ${THEME_IDS.map(id=>`<button class="thcard ${id===cur?'on':''}" data-action="devgo" data-v="theme:${id}">${themePreview(id)}
        <span><span class="nm">${THEMES[id].name}</span><span class="ds">${THEMES[id].desc}</span></span><span class="ck">${id===cur?'✓ 使用中':'›'}</span></button>`).join('')}`;
  }
  if(devView.startsWith('theme:')){
    const id=devView.slice(6),th=THEMES[id];if(!th){devView='themes';return devHtml()}
    const u=(S.themeText||{})[id]||{},tx=themeText(id),cur=themeId()===id;
    const grp=g=>{const l=(u.comments&&u.comments[g])||th.comments[g];
      return `<div class="cgrp"><div class="hd"><span class="gd g-${g}">${g}</span>${g} 的評語</div>
      ${l.map((c,k)=>`<div class="crow"><input type="text" value="${esc(c)}" data-edit="gc" data-t="${id}" data-g="${g}" data-i="${k}" aria-label="${g} 評語 ${k+1}"><button class="icon-btn" data-action="gcdel" data-t="${id}" data-g="${g}" data-i="${k}" aria-label="刪除評語">✕</button></div>`).join('')}
      <button class="ghost" data-action="gcadd" data-t="${id}" data-g="${g}">新增評語</button></div>`};
    return `${devTop(['themes','結算風格'])}<h1>${th.name}</h1>
      ${themePreview(id,true)}
      <div class="btns" style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="${cur?'ghost':'gbtn'}" style="flex:1 1 140px" data-action="themeuse" data-t="${id}" ${cur?'disabled':''}>${cur?'✓ 使用中':'使用這個風格'}</button>
        <button class="ghost" style="flex:1 1 140px" data-action="themeprev" data-t="${id}">預覽結算畫面</button></div>
      <h3 style="font-size:15px;margin:24px 0 4px">稱號</h3>
      <p class="note" style="margin:0 0 8px">顯示在評等旁邊的稱號，留空會使用預設值。</p>
      ${'SABC'.split('').map(g=>`<div class="trow"><span class="gd g-${g}">${g}</span><input type="text" value="${esc((u.titles||{})[g]??tx.titles[g])}" placeholder="${esc(th.titles[g])}" data-edit="tt" data-t="${id}" data-g="${g}" aria-label="${g} 的稱號"></div>`).join('')}
      <h3 style="font-size:15px;margin:24px 0 0">評語</h3>
      <p class="note" style="margin:4px 0 0">每個月會從該評等的評語中固定挑一句；空白的評語會被略過。</p>
      ${'SABC'.split('').map(grp).join('')}
      <button class="ghost danger" style="margin-top:18px" data-action="tcreset" data-t="${id}">恢復這個風格的預設稱號與評語</button>`;
  }
  return `${devTop(null)}<h1>開發者選項</h1>
    <button class="devitem" data-action="devgo" data-v="rules"><span><span class="t">評等條件</span><span class="s">調整 S、A、B 的判斷門檻，所有風格共用</span></span><span>›</span></button>
    <button class="devitem" data-action="devgo" data-v="themes"><span><span class="t">結算風格</span><span class="s">目前：${THEMES[themeId()].name}・切換風格、調整各風格的稱號與評語</span></span><span>›</span></button>
    <button class="ghost" style="width:100%;margin-top:18px" data-action="devoff">關閉開發者模式</button>
    <p class="note" style="margin-top:10px">也可以在設定頁連點版本號 7 次來關閉。</p>`;
}
function openDev(v){
  devView=v||'home';
  let el=document.getElementById('dev');
  if(!el){el=document.createElement('div');el.className='sum dev';el.id='dev';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','開發者選項');document.body.appendChild(el);lockScroll()}
  el.innerHTML=`<div class="sum-in">${devHtml()}</div>`;el.scrollTop=0;
}
function closeDev(){const el=document.getElementById('dev');if(el){el.remove();unlockScroll()}}
function devRender(keep){const el=document.getElementById('dev');if(el){const y=el.scrollTop;el.innerHTML=`<div class="sum-in">${devHtml()}</div>`;el.scrollTop=keep?y:0}}
