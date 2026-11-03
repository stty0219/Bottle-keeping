// 啟動流程、匯出／還原備份、匯出 CSV（init() 在 main.js 最後呼叫）
function init(){
  S=loadLocal()||defaults();
  migrate();migrateJarPlan();migrateTheme();saveLocal();
  render();
  syncStatus();
  updateBell();setTimeout(()=>checkUpdate(true),8000);
  cloudInit();
  if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js?v='+encodeURIComponent(APP_VERSION)).catch(()=>{})}
}
function exportData(){
  const {ledgerId,ledgerOwner,ledgerName,...plain}=S;const blob=new Blob([JSON.stringify(plain,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='分罐記帳備份-'+today()+'.json';
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}
function exportCSV(){
  const rows=[['日期','類型','金額','分類','罐子','備註']];
  for(const t of [...S.txns].sort((a,b)=>a.date<b.date?-1:1)){
    if(t.type==='expense'){const c=catById(t.catId),b=bucketById(t.bucketId);rows.push([t.date,'支出',t.amount,c?c.name:'',b?b.name:'',t.note])}
    else if(t.type==='income'){rows.push([t.date,'收入',t.amount,'',Object.entries(incAlloc(t)).filter(([,v])=>v).map(([k,v])=>nameOf(k)+' '+v).join('；'),t.note])}
    else rows.push([t.date,'轉移',t.amount,'',nameOf(t.from)+'→'+nameOf(t.to),t.note]);
  }
  const csv='\ufeff'+rows.map(r=>r.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='分罐記帳-'+today()+'.csv';
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}
function importData(file){
  const r=new FileReader();
  r.onload=()=>{try{const d=JSON.parse(r.result);if(!d.buckets||!d.categories||!d.txns)throw 0;
    if(!confirm(cloudOn()?'用備份檔取代目前所有資料？雲端帳本也會一起被取代。':'用備份檔取代目前所有資料？'))return;replaceAll(d);toast('已還原備份')}catch(e){toast('這不是有效的備份檔')}};
  r.readAsText(file);
}
