// 計算核心的測試載入器
// App 的 js 是一般 script（共用全域範圍），這裡用 node:vm 建立一個隔離的 context，
// 依 index.html 的順序載入計算需要的檔案，並提供最小的瀏覽器替身。App 的程式不需要為測試修改。
'use strict';
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
// 測試中的「今天」：所有 curMonth()、setJarPlan()、checkGoals() 都以這一天為準
const TODAY = '2026-11-15';
const CUR = TODAY.slice(0, 7);

// index.html 的載入順序中，計算核心與它用到的檔案（順序不能改）
const FILES = [
  'js/config.js',        // APP_VERSION（changelog.js 頂層會讀）
  'js/changelog.js',
  'js/state.js',         // today()、S、money()
  'js/cloud.js',         // Cloud、persist()
  'js/shared-jars.js',   // myUid()、jarsList()、jarName()、desiredMirrors()
  'js/setup.js',         // migrate()、migrateAlloc()
  'js/calc.js',          // 計算核心
  'js/views/home.js',    // saveView()、goalView()、checkGoals()
  'js/summary.js',       // monthData()、gradeOf()
  'js/reorder.js',       // shelfPos()（sharedSpend()、jarsList() 會用到）
];

// 固定「今天」：沒有參數的 new Date() 與 Date.now() 回傳固定時間，有參數時照常運作
function fixedDateSource(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `(()=>{const R=Date,T=new R(${y},${m - 1},${d},12,0,0).getTime();
    class D extends R{constructor(...a){super(...(a.length?a:[T]))}static now(){return T}}
    globalThis.Date=D;})();`;
}

function element() {
  return {
    textContent: '', innerHTML: '', value: '', dataset: {}, style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute() {}, getAttribute: () => null, addEventListener() {}, removeEventListener() {},
    appendChild() {}, remove() {}, focus() {}, blur() {}, click() {},
    querySelector: () => null, querySelectorAll: () => [], closest: () => null,
  };
}

function loadCore() {
  const store = new Map();
  const toasts = [];
  const sandbox = {
    console,
    // 瀏覽器替身：只提供這些檔案頂層與受測函式會用到的部分
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
      clear: () => store.clear(),
    },
    navigator: { onLine: true, userAgent: 'node-test' },
    location: { href: 'http://localhost/', reload() {} },
    document: {
      documentElement: element(),
      body: element(),
      activeElement: null,
      visibilityState: 'visible',
      addEventListener() {}, removeEventListener() {},
      getElementById: () => element(),
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => element(),
    },
    addEventListener() {}, removeEventListener() {},
    // 計時器立即執行（checkGoals() 的提示用 setTimeout 延後）
    setTimeout: fn => { fn(); return 0; },
    clearTimeout() {},
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fixedDateSource(TODAY), ctx, { filename: 'fixed-date.js' });
  // ui.js（提示訊息）不載入：用替身記錄提示內容
  vm.runInContext('var undoFn=null;function toast(m){__toasts.push(String(m))}', ctx);
  sandbox.__toasts = toasts;
  for (const f of FILES) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }

  const run = code => vm.runInContext(code, ctx);
  // context 內的物件和 Node 的原型不同，比對前一律轉成一般 JSON
  const plain = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const call = (name, ...args) => {
    sandbox.__args = JSON.parse(JSON.stringify(args));
    return plain(run(`${name}(...__args)`));
  };

  const api = {
    TODAY, CUR, toasts, run, plain, call,
    // 換一份帳本（同時清掉計算快取，等同 App 的 saveLocal()），並重設共用罐狀態
    setState(state, cloud) {
      sandbox.__state = JSON.stringify(state);
      sandbox.__cloud = JSON.stringify(cloud || {});
      run(`S=JSON.parse(__state);planCache=null;horizonCache=null;
        {const c=JSON.parse(__cloud);Cloud.user=c.user||null;Cloud.jars=c.jars||{};Cloud.jarTxns=c.jarTxns||{};}`);
      toasts.length = 0;
    },
    // 目前的 S（JSON 複本）
    state: () => plain(run('S')),
    // stats() 的結果：{bucketId: {...}}
    stats: (month, excludeId) => call('stats', excludeId || null, month || CUR),
  };
  return api;
}

module.exports = { loadCore, TODAY, ROOT };
