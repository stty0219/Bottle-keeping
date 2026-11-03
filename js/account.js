// 帳號登入／登出與帳號區塊的畫面
/* ---------- auth actions ---------- */
const AUTH_MSG={'auth/invalid-email':'Email 格式不正確','auth/invalid-credential':'Email 或密碼不正確','auth/wrong-password':'Email 或密碼不正確','auth/user-not-found':'找不到這個帳號，請先建立帳號','auth/email-already-in-use':'這個 Email 已經註冊過，請直接登入','auth/weak-password':'密碼至少需要 6 個字元','auth/popup-blocked':'登入視窗被擋住了，請允許彈出視窗後再試','auth/popup-closed-by-user':'登入視窗已關閉','auth/unauthorized-domain':'這個網址還沒加入 Firebase 的授權網域','auth/operation-not-allowed':'Firebase 還沒開啟這種登入方式','auth/network-request-failed':'需要網路連線才能登入','auth/too-many-requests':'嘗試次數太多，請稍後再試'};
async function authDo(kind){
  if(!Cloud.ready)return;
  Cloud.err='';Cloud.busy=true;renderIfSettings();
  try{
    if(kind==='google'){await Cloud.auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())}
    else{
      const em=document.getElementById('em').value.trim(),pw=document.getElementById('pw').value;
      if(kind==='signup')await Cloud.auth.createUserWithEmailAndPassword(em,pw);
      else if(kind==='login')await Cloud.auth.signInWithEmailAndPassword(em,pw);
      else if(kind==='resetpw'){await Cloud.auth.sendPasswordResetEmail(em);toast('重設密碼信已寄出')}
    }
  }catch(e){Cloud.err=AUTH_MSG[e.code]||('登入失敗：'+(e.code||e.message))}
  Cloud.busy=false;renderIfSettings();
}
async function signOutCloud(){
  if(!confirm('登出後，資料會保留在這台裝置上，但不會再同步。確定登出？'))return;
  S.ledgerId=null;S.ledgerOwner=null;saveLocal();
  await Cloud.auth.signOut();toast('已登出');
}
function accountHtml(){
  if(!cloudConfigured())return `<div class="acct"><div class="note">雲端同步尚未設定。完成 Firebase 設定並填入 firebase-config.js 後，這裡就會出現登入選項。</div></div>`;
  const err=`<div class="err">${esc(Cloud.err)}</div>`;
  if(Cloud.user){
    return `<div class="acct"><div><div class="note">已登入</div><div class="who">${esc(Cloud.user.email||Cloud.user.displayName||'')}</div></div>
    <div class="note">帳本：${esc(S.ledgerName||'我的帳本')}。在其他裝置用同一個帳號登入，就能看到相同的資料。</div>${err}
    <div class="btns"><button class="ghost" data-action="signout">登出</button></div></div>`;
  }
  const d=Cloud.busy?'disabled':'';
  return `<div class="acct"><div class="note">登入後，資料會同步到雲端，換手機或用電腦也能使用。這台裝置上現有的資料會一起上傳。</div>
    <button class="gbtn" data-action="auth" data-k="google" ${d}>用 Google 帳號登入</button>
    <div class="or">或使用 Email（iPhone 主畫面 App 建議用這個）</div>
    <input type="email" id="em" placeholder="Email" autocomplete="email" inputmode="email">
    <input type="password" id="pw" placeholder="密碼（至少 6 個字元）" autocomplete="current-password">
    ${err}
    <div class="btns"><button class="gbtn" data-action="auth" data-k="login" ${d}>登入</button><button class="ghost" data-action="auth" data-k="signup" ${d}>建立帳號</button></div>
    <button class="ghost" style="border:0;padding:4px;font-size:13px;color:var(--muted)" data-action="auth" data-k="resetpw">忘記密碼</button></div>`;
}
