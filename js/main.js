// 事件處理，最後啟動 App
/* ---------- events ---------- */
document.addEventListener('click',e=>{
  const tb=e.target.closest('[data-tab]');
  if(tb){tab=tb.dataset.tab;render();window.scrollTo(0,0);return}
  const el=e.target.closest('[data-action]');if(!el)return;
  const a=el.dataset.action,id=el.dataset.id;
  switch(a){
    case 'open-add':openAdd('expense');break;
    case 'close':closeSheet();break;
    case 'type':draft.type=el.dataset.t;draft.view=null;sheetRender();break;
    case 'kp':pressKey(el.dataset.k);break;
    case 'kpshow':{const a=document.activeElement;if(a&&a.blur)a.blur();document.getElementById('sheet').classList.remove('kp-hide');break}
    case 'catall':draft.view='cats';sheetRender();document.getElementById('sheet').scrollTop=0;break;
    case 'catback':draft.view=null;sheetRender();break;
    case 'catpick':draft.catId=id;draft.view=null;sheetRender();break;
    case 'cat':draft.catId=id;document.querySelectorAll('.catchip[data-action=cat]').forEach(c=>c.setAttribute('aria-pressed',c.dataset.id===id));updateHint();break;
    case 'save':saveDraft();break;
    case 'tx':openTx(id);break;
    case 'stx':openShared(el.dataset.jid,id);break;
    case 'swdel':swipeDelete(el.dataset.ref);break;
    case 'vertap':verTap();break;
    case 'devopen':openDev('home');break;
    case 'devgo':devView=el.dataset.v;devRender();break;
    case 'devclose':closeDev();break;
    case 'devoff':try{localStorage.setItem(DEV_KEY,'0')}catch(_){}closeDev();render();toast('已關閉開發者模式');break;
    case 'grreset':S.gradeRules=null;persist();devRender(true);toast('已恢復預設條件');break;
    case 'gcadd':{const u=ensureThemeText(el.dataset.t);u.comments[el.dataset.g].push('');persist();devRender(true);const ins=document.querySelectorAll(`#dev [data-edit=gc][data-g="${el.dataset.g}"]`);if(ins.length)ins[ins.length-1].focus();break}
    case 'gcdel':{const u=ensureThemeText(el.dataset.t),l=u.comments[el.dataset.g];if(l.length<=1){toast('每個評等至少要保留一句評語');break}l.splice(+el.dataset.i,1);persist();devRender(true);break}
    case 'tcreset':if(!confirm(`確定把「${THEMES[el.dataset.t].name}」的稱號和評語恢復成預設？`))break;if(S.themeText)delete S.themeText[el.dataset.t];persist();devRender(true);toast('已恢復預設');break;
    case 'themeuse':S.sumTheme=el.dataset.t;persist();devRender(true);toast(`已套用「${THEMES[el.dataset.t].name}」`);break;
    case 'themeprev':{const mk=lastFinishedMonth();if(!mk){toast('還沒有已結束、而且有紀錄的月份可以預覽');break}openSummary(mk,el.dataset.t);break}
    case 'catx':{if(!sumState)break;const k=el.dataset.k;sumState.open.has(k)?sumState.open.delete(k):sumState.open.add(k);rerenderSummary();break}
    case 'catmore':if(sumState){sumState.all.add(el.dataset.k);rerenderSummary()}break;
    case 'bell':openNotice();break;
    case 'nclear':{const n=notice();if(n.v===APP_VERSION)setNotice(Object.assign(n,{cleared:true}));closeSheet();updateBell();break}
    case 'reloadapp':location.reload();break;
    case 'summary':openSummary(listMonth);break;
    case 'sumclose':closeSummary();break;
    case 'settle':{settleOpen=!settleOpen;const s=el.closest('.settle');s.classList.toggle('open',settleOpen);el.setAttribute('aria-expanded',settleOpen);break}
    case 'qclear':{listQuery='';const i=document.getElementById('lq');if(i){i.value='';i.focus()}document.getElementById('sbox').classList.add('empty');refreshResults();break}
    case 'qall':listAllMonths=!listAllMonths;el.setAttribute('aria-pressed',listAllMonths);refreshResults();break;
    case 'emopick':openEmoji(id,el.dataset.jid);break;
    case 'emoset':applyEmoji(el.dataset.e);break;
    case 'emocustom':{const v=lastEmoji(document.getElementById('emocustom').value);if(!v){toast('請輸入一個 emoji');break}applyEmoji(v);break}
    case 'undo':{const f=undoFn;undoFn=null;document.getElementById('toast').classList.remove('show','act');if(f)f();break}
    case 'delstx':if(!confirm('確定刪除這筆紀錄？'))break;jarTxnRef(el.dataset.jid,id).delete().catch(()=>toast('刪除失敗'));closeSheet();render();toast('已刪除');break;
    case 'newjar':createJar();break;
    case 'invite':inviteTo(el.dataset.jid);break;
    case 'uninvite':cancelInvite(id);break;
    case 'accept':acceptInvite(id);break;
    case 'decline':declineInvite(id);break;
    case 'leavejar':leaveJar(el.dataset.jid);break;
    case 'deljar':deleteJar(el.dataset.jid);break;
    case 'rmmember':removeMember(el.dataset.jid,id);break;
    case 'verify':sendVerify();break;
    case 'verified':checkVerified();break;
    case 'jcolor':{const j=Cloud.jars[el.dataset.jid];if(!j)break;j.color=PALETTE[(PALETTE.indexOf(j.color)+1)%PALETTE.length];saveJarMeta(el.dataset.jid,['color']);render();break}
    case 'jaddc':{const j=Cloud.jars[el.dataset.jid];if(!j)break;j.categories=(j.categories||[]).concat([{id:uid(),emoji:'🏷️',name:'新分類'}]);saveJarMeta(el.dataset.jid,['categories']);render();break}
    case 'jdelc':{const j=Cloud.jars[el.dataset.jid];if(!j)break;j.categories=(j.categories||[]).filter(c=>c.id!==id);saveJarMeta(el.dataset.jid,['categories']);render();break}
    case 'deltx':if(!confirm('確定刪除這筆紀錄？'))break;removeTxn(id);closeSheet();render();toast('已刪除');break;
    case 'mshift':listMonth=shiftMonth(listMonth,+el.dataset.d);listCat=null;resetPie();render();break;
    case 'tolist':listBucket='all';tab='list';render();window.scrollTo(0,0);break;
    case 'pie':{const k=el.dataset.key;if(listBucket==='all'){listBucket=k;listCat=null;resetPie()}else listCat=listCat===k?null:k;render();break}
    case 'jump':listBucket=el.dataset.bucket;listCat=null;resetPie();tab='list';render();window.scrollTo(0,0);break;
    case 'lb':listBucket=el.dataset.b;listCat=null;resetPie();render();break;
    case 'color':{const b=bucketById(id);b.color=PALETTE[(PALETTE.indexOf(b.color)+1)%PALETTE.length];persist();render();break}
    case 'addb':S.buckets.push({id:'b_'+uid(),name:'新罐子',pct:0,amt:0,color:PALETTE[S.buckets.length%PALETTE.length]});persist();render();break;
    case 'delb':{
      const used=S.txns.some(t=>t.bucketId===id||(t.type==='income'&&t.mode==='one'&&t.target===id)||t.from===id||t.to===id)||S.categories.some(c=>c.bucketId===id)||Object.values(S.jarPlan||{}).some(jp=>(jp.hist||[]).some(x=>x.src===id&&+x.amt>0));
      if(S.buckets.length<=1){toast('至少要保留一個罐子');break}
      if(used){toast('這個罐子有紀錄或分類在用，先把分類改到別的罐子');break}
      S.buckets=S.buckets.filter(b=>b.id!==id);if(S.remainderId===id)S.remainderId=S.buckets[S.buckets.length-1].id;persist();render();break}
    case 'addc':S.categories.push({id:uid(),emoji:'🏷️',name:'新分類',bucketId:S.buckets[0].id});persist();render();break;
    case 'delc':S.categories=S.categories.filter(c=>c.id!==id);persist();render();break;
    case 'export':exportData();break;
    case 'csv':exportCSV();break;
    case 'import':document.getElementById('importFile').click();break;
    case 'reset':if(confirm(cloudOn()?'確定清除所有紀錄與設定？雲端帳本也會一起清空，無法復原。':'確定清除所有紀錄與設定？這個動作無法復原。')){replaceAll(defaults());toast('已清除')}break;
    case 'auth':authDo(el.dataset.k);break;
    case 'signout':signOutCloud();break;
  }
});
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='lq'){listQuery=t.value;document.getElementById('sbox').classList.toggle('empty',!t.value);refreshResults();return}
  if(t.id==='emocustom'){const v=lastEmoji(t.value);if(t.value!==v)t.value=v;return}
  if(t.dataset.edit==='gc'){const u=ensureThemeText(t.dataset.t);u.comments[t.dataset.g][+t.dataset.i]=t.value;persist();return}
  if(t.dataset.edit==='tt'){const u=ensureThemeText(t.dataset.t);u.titles[t.dataset.g]=t.value;persist();return}
  if(draft){
    if(t.id==='amt'){t.value=t.value.replace(/[^0-9]/g,'');draft.amount=t.value;updateHint();return}
    if(t.id==='note'){draft.note=t.value;return}
  }
  const ed=t.dataset.edit;if(!ed||ed==='bcarry')return;
  if(ed==='jname'||ed==='jcemoji'||ed==='jcname'){
    const j=Cloud.jars[t.dataset.jid];if(!j)return;
    if(ed==='jname'){j.name=t.value;saveJarMeta(t.dataset.jid,['name'])}
    else{const c=(j.categories||[]).find(x=>x.id===t.dataset.id);if(!c)return;c[ed==='jcemoji'?'emoji':'name']=t.value;saveJarMeta(t.dataset.jid,['categories'])}
    return;
  }
  if(ed==='jamt'){setJarPlan(t.dataset.jid,'amt',Math.max(0,parseInt(t.value)||0));persist();return}
  if(ed==='bname')bucketById(t.dataset.id).name=t.value;
  if(ed==='bamt'){bucketById(t.dataset.id).amt=Math.max(0,parseInt(t.value)||0);const ps=document.querySelector('#plansum b');if(ps)ps.textContent=money(planSum())}
  if(ed==='cemoji')catById(t.dataset.id).emoji=t.value;
  if(ed==='cname')catById(t.dataset.id).name=t.value;
  persist();
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='importFile'&&t.files[0]){importData(t.files[0]);t.value='';return}
  if(t.id==='lm'||t.id==='hm'){listMonth=t.value||curMonth();listCat=null;resetPie();render();return}
  if(t.dataset.edit==='bcarry'){bucketById(t.dataset.id).carry=t.checked;persist();render();return}
  if(draft){
    if(t.id==='date'){draft.date=t.value;updateHint();return}
    if(t.id==='mode'){draft.mode=t.value;document.getElementById('tgtWrap').classList.toggle('hidden',t.value!=='one');updateHint();return}
    if(t.id==='tgt'){draft.target=t.value;updateHint();return}
    if(t.id==='from'){draft.from=t.value;updateHint();return}
    if(t.id==='to'){draft.to=t.value;updateHint();return}
  }
  if(t.dataset.edit==='cbucket'){catById(t.dataset.id).bucketId=t.value;persist();render()}
  if(t.dataset.edit==='gr'){
    const r=gradeRules(),k=t.dataset.k;let v=Math.max(0,parseInt(t.value)||0);
    if(k==='bMaxOver')r.bMaxOver=Math.min(20,v);
    else{v=Math.min(100,v)/100;r[k]=v;
      if(k==='aRate'&&r.aRate>r.sRate){r.aRate=r.sRate;toast('A 的門檻不能高於 S，已調整為相同')}
      if(k==='sRate'&&r.aRate>r.sRate){r.aRate=r.sRate;toast('A 的門檻已一併調低，不能高於 S')}}
    S.gradeRules=r;persist();devRender(true);return}
  if(t.dataset.edit==='sumsort'){try{localStorage.setItem(SORT_KEY,t.value)}catch(_){}rerenderSummary();return}
  if(t.dataset.edit==='motion'){try{localStorage.setItem(MOTION_KEY,t.value)}catch(_){}applyMotion();stopPieSpin();toast('已更新動態效果');return}
  if(t.dataset.edit==='remainder'){S.remainderId=t.value;const b=bucketById(t.value);if(b&&b.carry===false){b.carry=true;toast(`「${b.name}」是指定罐子，已改為結轉`)}persist();render();return}
  if(t.dataset.edit==='jsrc'){setJarPlan(t.dataset.jid,'src',t.value);persist();render();return}
  if(['bname','bamt','jamt','jname'].includes(t.dataset.edit))render();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(document.getElementById('dev')){closeDev();return}if(document.getElementById('summary')){closeSummary();return}closeSheet()}if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('[role=button][data-action]')){e.preventDefault();e.target.click();return}if(e.key==='Enter'&&e.target.id==='lq'){e.preventDefault();e.target.blur();return}if(e.key==='Enter'&&e.target.id==='emocustom'){e.preventDefault();const v=lastEmoji(e.target.value);if(v)applyEmoji(v);else toast('請輸入一個 emoji');return}if(e.key==='Enter'&&(e.target.id==='pw'||e.target.id==='em')){authDo('login');return}if(e.key==='Enter'&&draft&&e.target.tagName==='INPUT'){if(draft.ok&&!hasOp(draft.expr||''))saveDraft();return}
  // physical keyboard on the calculator
  if(draft&&document.getElementById('kp')&&!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)){
    const map={'+':'+','-':'−','*':'×','x':'×','/':'÷','.':'.','Backspace':'del','Enter':'go','=':'go','Delete':'AC'};
    const k=/^\d$/.test(e.key)?e.key:map[e.key];
    if(k){e.preventDefault();pressKey(k)}
  }});
// hide the calculator while typing a note or picking a date; bring it back afterwards
document.addEventListener('focusin',e=>{if(e.target.closest&&e.target.closest('#sheetBody')&&/INPUT|SELECT/.test(e.target.tagName)&&document.getElementById('kp'))document.getElementById('sheet').classList.add('kp-hide')});
document.addEventListener('focusout',e=>{if(!(e.target.closest&&e.target.closest('#sheetBody')))return;setTimeout(()=>{const a=document.activeElement;if(!(a&&a.closest&&a.closest('#sheetBody')&&/INPUT|SELECT/.test(a.tagName)))document.getElementById('sheet').classList.remove('kp-hide')},60)});
const obs=new MutationObserver(()=>{if(draft&&document.getElementById('hint')&&!document.getElementById('hint').dataset.init){document.getElementById('hint').dataset.init=1;updateHint()}});
obs.observe(document.getElementById('sheetBody'),{childList:true});

init();
