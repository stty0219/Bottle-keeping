// 版本號。改版時 APP_VERSION 加一，並在 js/changelog.js 的 CHANGELOG 最上方新增一筆。
// ===== App version: change only this line when releasing (sw.js picks it up automatically) =====
const APP_VERSION='v38';
// 開發者帳號的 Firebase uid：只有這個帳號看得到「回報管理」。修改時 firestore.rules 的 isDev() 也要一起改。
const DEV_UID='4wumuhJJLHQqQwcK4uNdwrXsrrc2';

/* ---------- 程式錯誤紀錄：最近 10 筆，存在這台裝置，回報問題時可以一併附上（畫面上不顯示） ---------- */
const ERRLOG_KEY='fenguan-errlog';
function errLog(){try{const v=JSON.parse(localStorage.getItem(ERRLOG_KEY));return Array.isArray(v)?v:[]}catch(e){return []}}
function logError(msg,src){
  try{
    const l=errLog();
    l.push({m:String(msg||'').slice(0,500),src:String(src||'').slice(0,200),t:Date.now()});
    localStorage.setItem(ERRLOG_KEY,JSON.stringify(l.slice(-10)));
  }catch(e){}
}
const errSrc=(file,line,col)=>file?`${String(file).replace(/^.*\//,'').replace(/\?.*$/,'')}:${line||0}:${col||0}`:'';
window.addEventListener('error',e=>{
  if(!e)return;
  const t=e.target;
  if(t&&t!==window&&!(e instanceof ErrorEvent)){ // a file that failed to load (only our scripts / stylesheets are worth noting)
    if(/^(SCRIPT|LINK)$/.test(t.tagName||''))logError('載入失敗：'+String(t.src||t.href||'?').replace(/^.*\//,''),'');
    return}
  logError(e.message||(e.error&&e.error.message)||'error',errSrc(e.filename,e.lineno,e.colno));
},true);
window.addEventListener('unhandledrejection',e=>{
  const r=e&&e.reason;
  const m=r&&(r.code?r.code+'：':'')+(r&&r.message||'')||String(r);
  const at=r&&r.stack?(String(r.stack).split('\n').find(s=>/\.js/.test(s))||'').trim():'';
  logError('Promise：'+m,at.replace(/^.*\//,'').replace(/\)$/,''));
});
