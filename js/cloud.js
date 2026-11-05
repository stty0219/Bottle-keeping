// Firebase 登入後的雲端同步：帳本、紀錄、寫入流程
/* ---------- cloud (Firebase) ---------- */
const Cloud={ready:false,user:null,fs:null,auth:null,ref:null,unsubs:[],metaTimer:null,err:'',busy:false,
  ledgerLoaded:false,jars:{},jarTxns:{},jarLoaded:{},jarUnsubs:{},jarsUnsub:null,inviteUnsubs:[],invites:[],sent:[],jarTimers:{},jarsLoaded:false};
function cloudConfigured(){return !!(window.FIREBASE_CONFIG&&window.FIREBASE_CONFIG.apiKey&&window.firebase)}
function cloudOn(){return !!(Cloud.user&&Cloud.ref)}
function syncStatus(){
  if(!cloudConfigured()||!Cloud.user){setSync('僅存於此裝置');return}
  if(!Cloud.ref){setSync('連線中…');return}
  if(!navigator.onLine){setSync('離線中，連線後自動同步');return}
  setSync('同步中…');
  Cloud.fs.waitForPendingWrites().then(()=>{if(cloudOn())setSync(navigator.onLine?'已同步':'離線中，連線後自動同步')}).catch(()=>{});
}
window.addEventListener('online',syncStatus);window.addEventListener('offline',syncStatus);

function cloudInit(){
  if(!cloudConfigured())return;
  try{
    firebase.initializeApp(window.FIREBASE_CONFIG);
    Cloud.auth=firebase.auth();Cloud.fs=firebase.firestore();
    Cloud.fs.enablePersistence({synchronizeTabs:true}).catch(()=>{});
    Cloud.ready=true;
    Cloud.auth.onAuthStateChanged(u=>{
      Cloud.user=u||null;
      if(u)cloudConnect().catch(e=>{Cloud.err='雲端連線失敗：'+(e.message||e.code);renderIfSettings();syncStatus()});
      else{cloudStop();syncStatus();renderIfSettings()}
    });
  }catch(e){Cloud.err='Firebase 設定有誤：'+e.message}
}
function cloudStop(){
  Cloud.unsubs.forEach(f=>{try{f()}catch(e){}});Cloud.unsubs=[];Cloud.ref=null;Cloud.ledgerLoaded=false;
  stopJars();
}

async function writeTxns(ref,txns){
  for(let i=0;i<txns.length;i+=400){
    const b=Cloud.fs.batch();
    txns.slice(i,i+400).forEach(t=>{const {id,...rest}=t;b.set(ref.collection('txns').doc(id),clean(rest))});
    await b.commit();
  }
}
async function deleteAllTxns(ref){
  const qs=await ref.collection('txns').get();
  for(let i=0;i<qs.docs.length;i+=400){const b=Cloud.fs.batch();qs.docs.slice(i,i+400).forEach(d=>b.delete(d.ref));await b.commit()}
}

async function cloudConnect(){
  const u=Cloud.user;Cloud.err='';syncStatus();
  const col=Cloud.fs.collection('ledgers');
  let lid=null;
  if(S.ledgerId&&S.ledgerOwner===u.uid){lid=S.ledgerId}
  else{
    const q=await col.where('members','array-contains',u.uid).get();
    if(q.empty){
      const ref=col.doc();
      await ref.set({name:'我的帳本',owner:u.uid,members:[u.uid],buckets:clean(S.buckets),categories:clean(S.categories),allocMode:S.allocMode||'amount',remainderId:S.remainderId||null,jarPlan:clean(S.jarPlan||{}),gradeRules:S.gradeRules||null,shelfOrder:S.shelfOrder||null,sumTheme:S.sumTheme||null,themeText:S.themeText?clean(S.themeText):null,
        createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
      await writeTxns(ref,S.txns);
      lid=ref.id;toast('已把這台裝置的資料上傳到雲端');
    }else{
      lid=q.docs[0].id;
      if(S.txns.length>0&&S.ledgerId!==lid){
        const ok=confirm(`這個帳號在雲端已經有帳本了。\n\n要改用雲端帳本嗎？這台裝置上的 ${S.txns.length} 筆紀錄會先下載成備份檔。\n\n按「取消」會登出，保留這台裝置的資料。`);
        if(!ok){await Cloud.auth.signOut();return}
        exportData();
      }
    }
  }
  S.ledgerId=lid;S.ledgerOwner=u.uid;saveLocal();
  subscribe(col.doc(lid));
}

function subscribe(ref){
  cloudStop();Cloud.ref=ref;
  const fail=e=>{ // ledger gone or no access: forget it and look again
    cloudStop();
    if(e&&e.code==='permission-denied'){S.ledgerId=null;saveLocal();cloudConnect().catch(()=>{})}
    else{Cloud.err='同步中斷：'+(e.message||e.code);renderIfSettings();syncStatus()}
  };
  Cloud.unsubs.push(ref.onSnapshot(snap=>{
    if(!snap.exists){fail({code:'permission-denied'});return}
    if(snap.metadata.hasPendingWrites)return;
    const d=snap.data();
    S.buckets=d.buckets||[];S.categories=d.categories||[];S.allocMode=d.allocMode||'pct';S.remainderId=d.remainderId||null;S.jarPlan=d.jarPlan||{};S.gradeRules=d.gradeRules||null;S.gradeComments=d.gradeComments||null;S.sumTheme=d.sumTheme||null;S.shelfOrder=d.shelfOrder||null;S.themeText=d.themeText||null;S.ledgerName=d.name||'我的帳本';
    const mig=migrateAlloc()|migrateJarPlan()|migrateTheme();saveLocal();safeRender();if(mig)persist();
    if(!Cloud.ledgerLoaded){Cloud.ledgerLoaded=true;startJars()}
    scheduleMirror();
  },fail));
  Cloud.unsubs.push(ref.collection('txns').onSnapshot(qs=>{
    S.txns=qs.docs.map(d=>Object.assign({},d.data(),{id:d.id}));
    saveLocal();safeRender();syncStatus();scheduleMirror();
  },fail));
  renderIfSettings();syncStatus();
}

/* re-render without stealing focus from a field being edited */
let renderQueued=false;
function safeRender(){
  const a=document.activeElement;
  if(a&&a.closest&&a.closest('#view')&&/INPUT|SELECT/.test(a.tagName)){renderQueued=true;return}
  render();
}
document.addEventListener('focusout',()=>{if(renderQueued){setTimeout(()=>{const a=document.activeElement;if(!(a&&a.closest&&a.closest('#view')&&/INPUT|SELECT/.test(a.tagName))){renderQueued=false;render()}},0)}});
function renderIfSettings(){if(tab==='settings')safeRender()}

/* ---------- write paths ---------- */
function persist(){ // buckets & categories
  saveLocal();
  if(!cloudOn())return;
  clearTimeout(Cloud.metaTimer);
  Cloud.metaTimer=setTimeout(()=>{
    Cloud.ref.update({buckets:clean(S.buckets),categories:clean(S.categories),allocMode:S.allocMode||'amount',remainderId:S.remainderId||null,jarPlan:clean(S.jarPlan||{}),shelfOrder:S.shelfOrder||null,gradeRules:S.gradeRules?clean(S.gradeRules):null,sumTheme:S.sumTheme||null,themeText:S.themeText?clean(S.themeText):null,gradeComments:null,updatedAt:firebase.firestore.FieldValue.serverTimestamp()})
      .catch(e=>{Cloud.err='設定沒有存到雲端：'+(e.message||e.code);renderIfSettings()});
    syncStatus();scheduleMirror();
  },600);
}
function putTxn(t){
  const i=S.txns.findIndex(x=>x.id===t.id);if(i>=0)S.txns[i]=t;else S.txns.push(t);
  saveLocal();
  if(cloudOn()){const {id,...rest}=t;Cloud.ref.collection('txns').doc(id).set(clean(rest)).catch(e=>toast('雲端儲存失敗：'+(e.code||'')));syncStatus();scheduleMirror()}
}
function removeTxn(id){
  S.txns=S.txns.filter(t=>t.id!==id);saveLocal();
  if(cloudOn()){Cloud.ref.collection('txns').doc(id).delete().catch(()=>{});syncStatus();scheduleMirror()}
}
async function replaceAll(data){ // import / reset
  const keep={ledgerId:S.ledgerId,ledgerOwner:S.ledgerOwner,ledgerName:S.ledgerName};
  S=Object.assign(data,keep);migrate();migrateAlloc();saveLocal();render();
  if(cloudOn()){
    setSync('同步中…');
    try{await deleteAllTxns(Cloud.ref);await writeTxns(Cloud.ref,S.txns);persist()}
    catch(e){toast('雲端更新失敗：'+(e.code||''))}
    syncStatus();
  }
}
