// 月結算畫面與 7 種結算風格（各風格的配色在 css/themes.css）
/* ---------- month summary (月結算) ---------- */
// grading thresholds are shared by every style (developer mode → 評等條件)
const GRADE_DEFAULT={sRate:0.30,aRate:0.10,bMaxOver:1};
const gradeRules=()=>Object.assign({},GRADE_DEFAULT,S.gradeRules||{});
const GRADE_ORDER='CBAS';
const STARS={S:4,A:3,B:2,C:1};

/* Each style (結算風格) = colours/animation in CSS (.th-<id>) + badge markup + wording + default titles/comments.
   To add a style: add one entry here and one CSS block. */
const BASE_L={
  kick:null,title:(y,m)=>`${y} 年 ${m} 月結算`,
  totals:'收支總覽',rank:'分類支出排行',jars:'罐子成績單',hl:'亮點數據',
  inc:'收入',spend:'支出',net:'結餘',hero:false,
  jarOk:v=>'✓ 剩 '+money(v),jarBad:v=>'⚠ 超支 '+money(v),
  big:'最大的一筆支出',freq:'最常記的分類',zero:'零支出天數',avg:'平均每日支出',up:'比上月增加最多',down:'比上月減少最多',
  prev:(p,g,a)=>`上月 ${p} → 本月 ${g} ${a}`,
  moreSpend:'比上月多花',lessSpend:'比上月少花',moreSave:'比上月多存',lessSave:'比上月少存',moreInc:'比上月多',lessInc:'比上月少',same:'和上月一樣',
  noPrev:'沒有上個月的資料可以比較。',rankNo:k=>k+1
};
const THEMES={
  classic:{name:'經典',desc:'彩色圓章，淡入與數字跳動',
    badge:(g)=>`<div class="bz g-${g}">${g}</div>`,L:{},
    titles:{S:'省錢達人',A:'穩健理財',B:'小有失守',C:'需要加油'},
    comments:{S:['這個月很省喔！你是省錢達人 🏆','每個罐子都守住了，太厲害了！✨','存錢功力滿分，繼續保持！💎'],
      A:['表現不錯！預算控制得很穩 👍','離省錢達人只差一步了！','穩穩的，這個月過得很踏實 🌱'],
      B:['有個罐子超支了，下個月注意一下就好','整體還行，再收斂一點會更好 🙂','小小失守，下個月扳回來！'],
      C:['這個月花得有點多喔…下個月一起加油 💪','錢包在哭泣了…先從一個罐子開始控制吧 🥲','沒關係，記下來就是改變的開始！']}},
  journal:{name:'手帳',desc:'紙張質感，評價章蓋下去',
    badge:(g,t)=>`<div class="bz g-${g}"><div class="in"><b>${g}</b><span>${esc(t)}</span></div></div>`,inBadge:true,
    L:{kick:(y)=>`${y}`,title:(y,m)=>`${m} 月的小結`,totals:'本月收支',rank:'花費排行',jars:'罐子點名',hl:'小筆記',
      jarOk:v=>'✓ 守住了・剩 '+money(v),jarBad:v=>'✗ 超支 '+money(v)},
    titles:{S:'完美的一個月',A:'很不錯的一個月',B:'普通的一個月',C:'辛苦的一個月'},
    comments:{S:['這個月的預算本寫得漂漂亮亮 ✍️','每一筆都花在刀口上，給自己蓋個章！'],A:['穩穩的一個月，記得獎勵自己一杯咖啡 ☕','差一點點就滿分了，下個月見！'],
      B:['有一個罐子超出預算了，翻翻小筆記看看原因','偶爾放縱一下沒關係，下個月再調整'],C:['這個月比較辛苦，寫下來就是改變的開始','先別灰心，下一頁會更好的 🌱']}},
  award:{name:'頒獎典禮',desc:'金色舞台，獎牌落下、彩帶灑落',confetti:true,
    badge:(g)=>`<div class="bz g-${g}"><div class="disc">${g}</div><div class="rib"><i></i><i></i></div></div>`,
    L:{kick:(y)=>`— ${y} 年度 —`,title:(y,m)=>`${m} 月頒獎典禮`,totals:'得獎紀錄',rank:'花費榜',jars:'各罐表現',hl:'特別獎項',
      rankNo:k=>['金','銀','銅'][k]||k+1,jarOk:v=>'🏅 剩 '+money(v),jarBad:v=>'失格・超支 '+money(v),
      big:'最大手筆獎',freq:'最常出場獎',zero:'自律獎',avg:'每日平均',up:'退步最多',down:'最佳進步獎',prev:(p,g,a)=>`上屆 ${p} → 本屆 ${g} ${a}`},
    titles:{S:'金獎得主',A:'銀獎得主',B:'銅獎得主',C:'參加獎'},
    comments:{S:['恭喜獲得本月最佳省錢獎 🏆','評審一致通過，實至名歸！'],A:['表現亮眼，獲得評審團肯定 👏','距離金獎只有一步之遙'],
      B:['入圍了！下次有機會拿更大的獎','評審建議：再收斂一點會更好'],C:['感謝參與，下個月再來挑戰金獎','重在參與，下個月再戰！']}},
  arcade:{name:'街機',desc:'像素遊戲風，星星逐顆亮起',
    badge:(g)=>`<div class="bz g-${g}"><div class="lt">RANK</div><div class="big">${g}</div><div class="stars">${[0,1,2,3].map(n=>`<i class="${n<STARS[g]?'':'off'}" style="--n:${n}">★</i>`).join('')}</div></div>`,
    L:{kick:(y,m)=>`STAGE ${String(m).padStart(2,'0')}`,title:(y,m,g)=>g==='C'?'STAGE FAILED?':'STAGE CLEAR',totals:'SCORE',rank:'ITEMS',jars:'JARS',hl:'BONUS',
      inc:'INCOME',spend:'SPEND',net:'SAVE',jarOk:v=>'OK '+money(v),jarBad:v=>'OVER '+money(v),
      big:'MAX HIT',freq:'COMBO',zero:'NO-SPEND DAYS',avg:'AVG / DAY',up:'POWER DOWN',down:'POWER UP',prev:(p,g,a)=>`LAST ${p} → NOW ${g} ${a}`,
      moreSpend:'比上關多花',lessSpend:'比上關少花',moreSave:'比上關多存',lessSave:'比上關少存',moreInc:'比上關多',lessInc:'比上關少',same:'和上關一樣',
      noPrev:'沒有上一關的紀錄可以比較。',rankNo:k=>String(k+1).padStart(2,'0')},
    titles:{S:'PERFECT!',A:'GREAT!',B:'GOOD',C:'TRY AGAIN'},
    comments:{S:['NEW RECORD! 你是傳說中的省錢玩家','ALL CLEAR! 零失誤通關'],A:['HIGH SCORE! 差一點就完美通關','操作穩定，繼續保持'],
      B:['STAGE CLEAR，但有一個罐子 HP 歸零','還有進步空間，再挑戰一次！'],C:['投幣再來一局吧','別放棄，下一關會更順利']}},
  card:{name:'集卡',desc:'像抽到一張卡，翻牌登場',inBadge:true,
    badge:(g,t)=>`<div class="bz g-${g}"><div class="t">本月評等</div><div class="big">${g}</div><div class="ln"></div><div class="r">${esc(t)}</div></div>`,
    L:{kick:()=>'本月抽卡結果',title:(y,m)=>`${y} 年 ${m} 月`,totals:'卡池統計',rank:'花費排行',jars:'罐子圖鑑',hl:'稀有掉落',
      jarOk:v=>'收藏中・剩 '+money(v),jarBad:v=>'已燒毀・超支 '+money(v)},
    titles:{S:'傳說級',A:'史詩級',B:'稀有級',C:'普通級'},
    comments:{S:['抽到傳說卡了！這個月的自制力爆表 ✨','閃卡出現！好好收藏這個月'],A:['史詩級的一個月，卡池很給力','差一點就是傳說，下次一定'],
      B:['稀有卡也不錯，下個月繼續抽','有一張卡被燒掉了…注意超支的罐子'],C:['這次是普通卡，下個月保底一定出貨','別灰心，抽卡和存錢都需要耐心']}},
  min:{name:'極簡',desc:'黑白細線，動畫最少',
    badge:(g)=>`<div class="bz g-${g}"><div class="in">${g}</div></div>`,
    L:{kick:()=>'月結算',title:(y,m)=>`${y}.${String(m).padStart(2,'0')}`,totals:'收支',rank:'支出排行',jars:'罐子',hl:'摘要',
      jarOk:v=>'剩 '+money(v),jarBad:v=>'超支 '+money(v)},
    titles:{S:'優異',A:'良好',B:'尚可',C:'待改善'},
    comments:{S:['預算全數達成。'],A:['表現穩定，維持即可。'],B:['一個罐子超出預算。'],C:['支出偏高，建議檢視。']}},
  street:{name:'街頭任務',desc:'動作電影感，標題重擊登場',side:true,
    badge:(g)=>`<div class="bz g-${g}">${g}</div>`,
    L:{kick:(y,m)=>`行動代號：${y} / ${String(m).padStart(2,'0')}`,title:(y,m,g)=>g==='C'?'任務勉強過關':'任務完成',
      totals:'戰果',rank:'開銷清單',jars:'金庫狀態',hl:'行動紀錄',inc:'進帳',spend:'開銷',net:'本月入袋',hero:true,
      jarOk:v=>'安全・剩 '+money(v),jarBad:v=>'被掏空・超支 '+money(v),
      big:'最大一筆開銷',freq:'最常出手',zero:'按兵不動',avg:'每日平均開銷',up:'開銷暴增',down:'開銷縮減',prev:(p,g,a)=>`上次行動 ${p} → 這次 ${g}`,
      moreSpend:'比上次行動多花',lessSpend:'比上次行動少花',moreSave:'比上次行動多撈',lessSave:'比上次行動少撈',moreInc:'比上次多進帳',lessInc:'比上次少進帳',same:'和上次一樣',
      noPrev:'沒有上一次行動的紀錄可以比較。',rankNo:k=>String(k+1).padStart(2,'0')},
    titles:{S:'俐落收工',A:'乾淨脫身',B:'有驚無險',C:'狼狽撤退'},
    comments:{S:['乾淨俐落，一毛都沒多花','這次行動堪稱教科書等級'],A:['順利脫身，戰利品到手','小有波折，但任務完成'],
      B:['差點失手，有個金庫被掏空了','驚險過關，下次計畫要更周密'],C:['行動失控，開銷爆表…先避避風頭','這次虧了，回去重新擬定計畫']}}
};
const THEME_IDS=Object.keys(THEMES);
const themeId=()=>THEMES[S.sumTheme]?S.sumTheme:'classic';
function themeText(id){ // titles and comments for a style, falling back to its defaults
  const t=THEMES[id],u=(S.themeText||{})[id]||{},titles={},comments={};
  for(const g of 'SABC'){
    titles[g]=((u.titles||{})[g]||'').trim()||t.titles[g];
    const l=((u.comments||{})[g]||[]).map(s=>String(s).trim()).filter(Boolean);comments[g]=l.length?l:t.comments[g];
  }
  return {titles,comments};
}
function ensureThemeText(id){
  S.themeText=S.themeText||{};const t=THEMES[id];
  const u=S.themeText[id]=S.themeText[id]||{};
  u.titles=Object.assign({},t.titles,u.titles||{});
  u.comments=u.comments||{};for(const g of 'SABC')if(!u.comments[g])u.comments[g]=t.comments[g].slice();
  return u;
}
function migrateTheme(){ // v22 kept one set of comments: it becomes the classic style's comments
  if(!S.gradeComments)return false;
  S.themeText=S.themeText||{};S.themeText.classic=Object.assign({},S.themeText.classic,{comments:S.gradeComments});
  S.gradeComments=null;return true;
}

function daysIn(mk){const [y,m]=mk.split('-').map(Number);return new Date(y,m,0).getDate()}
function monthData(mk){
  const me=myUid();
  const inc=S.txns.filter(t=>t.type==='income'&&t.date.slice(0,7)===mk).reduce((a,t)=>a+t.amount,0);
  const exps=[];
  for(const t of S.txns)if(t.type==='expense'&&t.date.slice(0,7)===mk){const c=catById(t.catId);exps.push({key:t.catId||'?',name:c?c.name:'已刪除分類',emoji:c?c.emoji:'🧾',amount:t.amount,full:t.amount,date:t.date,note:t.note||'',shared:false,mine:true})}
  for(const j of jarsList())for(const t of (Cloud.jarTxns[j.id]||[]))if(t.kind==='expense'&&t.date.slice(0,7)===mk)
    exps.push({key:'s:'+(t.catKey||t.catName||'?'),name:t.catName||'共用支出',emoji:t.emoji||'🧾',amount:myShare(t),full:t.amount,date:t.date,note:t.note||'',shared:true,jar:j.name,mine:t.by===me,by:t.by===me?'你':(t.byName||'成員')});
  const spend=exps.reduce((a,e)=>a+e.amount,0);
  const cats={};for(const e of exps){const g=cats[e.key]||(cats[e.key]={key:e.key,name:e.name,emoji:e.emoji,shared:e.shared,value:0,count:0,n:0});g.value+=e.amount;g.n++;if(e.mine)g.count++}
  const st=stats(null,mk);
  const jars=S.buckets.map(b=>{const s=st[b.id]||{open:0,monthIn:0,monthOut:0,bal:0};return {name:b.name,color:b.color,avail:Math.max(0,s.open)+s.monthIn,spent:s.monthOut,bal:s.bal,over:s.over||0,covered:s.covered||0}});
  const sjars=jarsList().map(j=>{const s=jarStats(j.id,mk);return {name:j.name,color:j.color,avail:Math.max(0,s.open)+s.monthIn,spent:s.monthOut,bal:s.bal,shared:true}});
  return {mk,inc,spend,net:inc-spend,exps,cats:Object.values(cats).sort((a,b)=>b.value-a.value),jars,sjars,
    over:jars.filter(j=>j.bal<0||j.over>0).length, // a reset jar covered by the designated jar still counts as overspent
has:inc>0||spend>0};
}
function gradeOf(d){
  const r=gradeRules();
  if(d.inc>0){
    const rate=d.net/d.inc;
    if(d.over===0&&rate>=r.sRate)return 'S';
    if(d.over===0&&rate>=r.aRate)return 'A';
    if(d.over<=r.bMaxOver&&d.net>=0)return 'B';
    return 'C';
  }
  return d.over===0?'A':d.over<=r.bMaxOver?'B':'C';
}
function pickComment(list,mk){let h=0;for(const c of mk)h=(h*31+c.charCodeAt(0))>>>0;return list[h%list.length]}
const pct=(a,b)=>b?Math.round(a/b*100):0;
function delta(cur,prev,kind,L){
  const d=cur-prev;if(!d)return `<span class="flat">${L.same}</span>`;
  const p=prev?`（${d>0?'+':'−'}${Math.abs(pct(d,Math.abs(prev)))}%）`:'';
  if(kind==='spend')return d>0?`<span class="bad">${L.moreSpend} ${money(d)}${p}</span>`:`<span class="good">${L.lessSpend} ${money(-d)}${p}</span>`;
  if(kind==='save')return d>0?`<span class="good">${L.moreSave} ${money(d)}</span>`:`<span class="bad">${L.lessSave} ${money(-d)}</span>`;
  return d>0?`<span class="good">${L.moreInc} ${money(d)}${p}</span>`:`<span class="flat">${L.lessInc} ${money(-d)}${p}</span>`;
}
const countSpan=(v,cls)=>`<span class="num ${cls||''}" data-count="${Math.round(v)}">${money(v)}</span>`;

// expanded category details
const SORT_KEY='fenguan-sumsort';
const SORTS=[['amt_desc','金額（大到小）'],['amt_asc','金額（小到大）'],['date_desc','日期（新到舊）'],['date_asc','日期（舊到新）']];
function sumSort(){try{const v=localStorage.getItem(SORT_KEY);if(SORTS.some(s=>s[0]===v))return v}catch(e){}return 'amt_desc'}
let sumState=null; // {mk, theme, open:Set, all:Set}
function catDetail(d,key){
  const s=sumSort(),list=d.exps.filter(e=>e.key===key).slice();
  list.sort((a,b)=>s==='amt_desc'?b.amount-a.amount:s==='amt_asc'?a.amount-b.amount:s==='date_desc'?(b.date<a.date?-1:b.date>a.date?1:0):(a.date<b.date?-1:a.date>b.date?1:0));
  const all=sumState.all.has(key),shown=all?list:list.slice(0,10);
  return `<div class="cdet"><div class="cdh"><span>${list.length} 筆</span>
    <label class="sortb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/></svg>${SORTS.find(x=>x[0]===s)[1]}
      <select data-edit="sumsort" aria-label="排序方式">${SORTS.map(([v,l])=>`<option value="${v}" ${v===s?'selected':''}>${l}</option>`).join('')}</select></label></div>
    ${shown.map(e=>`<div class="cd"><span class="dt">${+e.date.slice(5,7)}/${+e.date.slice(8)}</span>
      <span class="nt">${e.note?esc(e.note):'<span class="flat">（無備註）</span>'}${e.shared?`<small>總額 ${money(e.full)}・${esc(e.by)}記錄</small>`:''}</span>
      <span class="am num">${money(e.amount)}</span></div>`).join('')}
    ${list.length>shown.length?`<button class="cdmore" data-action="catmore" data-k="${esc(key)}">顯示全部 ${list.length} 筆</button>`:''}</div>`;
}
function summaryHtml(mk,tid){
  const th=THEMES[tid],L=Object.assign({},BASE_L,th.L),tx=themeText(tid);
  const d=monthData(mk),p=monthData(shiftMonth(mk,-1));
  const [y,m]=mk.split('-').map(Number);
  let i=0;const A=()=>`anim" style="--i:${i++}`;
  if(!d.has)return `<div class="sum-head"><div class="sum-title">${esc(L.title(y,m,'A'))}</div></div><div class="empty">這個月還沒有收入或支出紀錄。</div>`;
  const g=gradeOf(d),pg=p.has?gradeOf(p):null,title=tx.titles[g];
  const arrow=pg?(GRADE_ORDER.indexOf(g)>GRADE_ORDER.indexOf(pg)?'⬆':GRADE_ORDER.indexOf(g)<GRADE_ORDER.indexOf(pg)?'⬇':'＝'):'';
  const comment=esc(pickComment(tx.comments[g],mk));
  let html=`<div class="sum-head">${L.kick?`<div class="kick">${esc(L.kick(y,m))}</div>`:''}
    <div class="sum-title ${tid==='street'&&g==='C'?'fail':''}">${esc(L.title(y,m,g))}</div>${tid==='street'?'<div class="slash"></div>':''}`;
  if(th.side)html+=`<div class="badgew">${th.badge(g,title)}<div><div class="gtitle g-${g}">評價：${esc(title)}</div><div class="sum-comment" style="font-size:13px;margin-top:2px">${comment}</div></div></div>`;
  else html+=`<div class="badgew">${th.badge(g,title)}</div>${th.inBadge?'':`<div class="gtitle g-${g}">${esc(title)}</div>`}<div class="sum-comment">${comment}</div>`;
  html+=`${pg?`<div class="sum-prev">${esc(L.prev(pg,g,arrow))}</div>`:''}</div>`;
  // totals
  const card=(k,v,dl)=>`<div class="scard"><div class="k">${k}</div><div class="v">${v}</div>${dl?`<div class="d">${dl}</div>`:''}</div>`;
  html+=`<section class="${A()}"><h3>${L.totals}</h3>`;
  if(L.hero)html+=`<div class="hero ${d.net<0?'neg':''}">${d.net>=0?'+':''}${countSpan(d.net)}</div>${p.has?`<div class="note" style="margin:2px 0 0">${delta(d.net,p.net,'save',L)}</div>`:''}
    <div class="cards2">${card(L.inc,countSpan(d.inc),p.has?delta(d.inc,p.inc,'inc',L):'')}${card(L.spend,countSpan(d.spend,'bad'),p.has?delta(d.spend,p.spend,'spend',L):'')}</div>`;
  else html+=`<div class="cards3">${card(L.inc,countSpan(d.inc),p.has?delta(d.inc,p.inc,'inc',L):'')}${card(L.spend,countSpan(d.spend),p.has?delta(d.spend,p.spend,'spend',L):'')}${card(L.net,countSpan(d.net,d.net<0?'bad':''),p.has?delta(d.net,p.net,'save',L):'')}</div>`;
  html+=`${p.has?'':`<p class="note" style="margin:8px 0 0">${L.noPrev}</p>`}
    ${d.sjars.length?'<p class="note" style="margin:8px 0 0">支出含共用支出中你的份額；撥到共用罐的錢不算支出。</p>':''}</section>`;
  // category ranking (tap to expand)
  const top=d.cats.length?d.cats[0].value:1;
  html+=`<section class="${A()}"><h3>${L.rank}</h3>${d.cats.length?d.cats.map((c,k)=>{const open=sumState.open.has(c.key);
    return `<div class="rank ${open?'open':''}"><button class="rankh" data-action="catx" data-k="${esc(c.key)}" aria-expanded="${open}"><span class="no">${L.rankNo(k)}</span>
      <span class="nm">${esc(c.emoji)} ${esc(c.name)}${c.shared?'<small>共用份額</small>':''}</span>
      <span class="am num">${money(c.value)}<small>${pct(c.value,d.spend)}%・${c.n} 筆</small></span><span class="cv">›</span>
      <div class="bar"><i style="width:${(c.value/top*100).toFixed(1)}%;background:${CAT_COLORS[k%CAT_COLORS.length]}"></i></div></button>
      ${open?catDetail(d,c.key):''}</div>`}).join(''):'<div class="empty" style="padding:12px 0">這個月沒有支出。</div>'}</section>`;
  // jars
  const jr=j=>`<div class="jrow"><span class="nm"><span class="dot" style="background:${j.color}"></span>${esc(j.name)}${j.shared?'<span class="pill">共用</span>':''}</span>
    <span class="st ${j.bal<0||j.over?'bad':'good'}">${j.over?L.jarBad(j.over)+`（${esc(remainderBucket().name)}墊付）`:j.bal<0?L.jarBad(-j.bal):L.jarOk(j.bal)}</span>
    <span class="ds num">花了 ${money(j.spent)} ／ 可用 ${money(j.avail)}${j.covered?`・墊付超支 ${money(j.covered)}`:''}</span></div>`;
  html+=`<section class="${A()}"><h3>${L.jars}</h3>${d.jars.map(jr).join('')}${d.sjars.map(jr).join('')}
    ${d.sjars.length?'<p class="note" style="margin:8px 0 0">共用罐不列入你的評等。</p>':''}</section>`;
  // highlights + comparison
  const big=d.exps.slice().sort((a,b)=>b.amount-a.amount)[0];
  const freq=d.cats.filter(c=>c.count).sort((a,b)=>b.count-a.count)[0];
  const upto=daysIn(mk);
  const spentDays=new Set(d.exps.filter(e=>e.amount>0).map(e=>e.date));
  const hc=(k,v,s)=>`<div class="scard"><div class="k">${k}</div><div class="v num">${v}</div>${s?`<div class="s">${s}</div>`:''}</div>`;
  let cmp='';
  if(p.has){
    const pm={};p.cats.forEach(c=>pm[c.key]=c.value);
    const keys=new Set([...d.cats.map(c=>c.key),...p.cats.map(c=>c.key)]),diffs=[];
    for(const k of keys){const c=d.cats.find(x=>x.key===k)||p.cats.find(x=>x.key===k);diffs.push({c,d:((d.cats.find(x=>x.key===k)||{}).value||0)-(pm[k]||0)})}
    const up=diffs.filter(x=>x.d>0).sort((a,b)=>b.d-a.d)[0],dn=diffs.filter(x=>x.d<0).sort((a,b)=>a.d-b.d)[0];
    cmp=`${up?hc(L.up,`<span class="bad">+${money(up.d)}</span>`,esc(up.c.emoji+' '+up.c.name)):''}${dn?hc(L.down,`<span class="good">−${money(-dn.d)}</span>`,esc(dn.c.emoji+' '+dn.c.name)):''}`;
  }
  html+=`<section class="${A()}"><h3>${L.hl}</h3><div class="hl">
    ${big?hc(L.big,money(big.amount),esc(big.emoji+' '+big.name+(big.note?'・'+big.note:'')+'・'+(+big.date.slice(5,7))+'/'+(+big.date.slice(8)))):''}
    ${freq?hc(L.freq,`${freq.count} 筆`,esc(freq.emoji+' '+freq.name)):''}
    ${hc(L.zero,`${Math.max(0,upto-spentDays.size)} 天`,`共 ${upto} 天`)}
    ${hc(L.avg,money(d.spend/upto),'')}
    ${cmp}</div></section>`;
  return html;
}
function openSummary(mk,tid){
  closeSummary();
  tid=THEMES[tid]?tid:themeId();
  sumState={mk,theme:tid,open:new Set(),all:new Set()};
  const el=document.createElement('div');el.className='sum th-'+tid;el.id='summary';
  el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','月結算');
  el.innerHTML=`<div class="sum-in"><div class="sum-top"><button class="sum-x" data-action="sumclose" aria-label="關閉">✕</button></div>${summaryHtml(mk,tid)}</div>`;
  if(THEMES[tid].confetti&&motionPref()==='standard'){
    const cf=document.createElement('div');cf.className='confetti';
    const cols=['#FAC775','#EF9F27','#F09595','#9FE1CB','#AFA9EC','#FAEEDA'];
    cf.innerHTML=Array.from({length:34},(_,k)=>`<i style="left:${Math.random()*100}%;background:${cols[k%cols.length]};animation-delay:${(0.9+Math.random()*1.4).toFixed(2)}s;animation-duration:${(2.2+Math.random()*1.6).toFixed(2)}s"></i>`).join('');
    el.appendChild(cf);
  }
  document.body.appendChild(el);lockScroll();
  if(motionPref()==='standard')countUp(el);
}
function rerenderSummary(){ // after expanding/sorting: no replay of the entrance animation
  const el=document.getElementById('summary');if(!el||!sumState)return;
  const y=el.scrollTop;el.classList.add('still');
  el.querySelector('.sum-in').innerHTML=`<div class="sum-top"><button class="sum-x" data-action="sumclose" aria-label="關閉">✕</button></div>${summaryHtml(sumState.mk,sumState.theme)}`;
  el.scrollTop=y;
}
function closeSummary(){const el=document.getElementById('summary');if(el){el.remove();unlockScroll()}sumState=null}
function countUp(root){
  root.querySelectorAll('[data-count]').forEach((n,k)=>{
    const end=+n.dataset.count,delay=440+k*140,dur=900;let t0=null;n.textContent=money(0);
    const step=t=>{if(!n.isConnected)return;if(root.classList.contains('still')){n.textContent=money(end);return}
      if(t0===null)t0=t;const x=Math.min(1,Math.max(0,(t-t0-delay)/dur));const e=1-Math.pow(1-x,3);n.textContent=money(end*e);if(x<1)requestAnimationFrame(step)};
    requestAnimationFrame(step);
  });
}
function lastFinishedMonth(){ // newest finished month that has records (for previews)
  let mk=shiftMonth(curMonth(),-1);
  for(let k=0;k<36;k++,mk=shiftMonth(mk,-1))if(monthData(mk).has)return mk;
  return null;
}
