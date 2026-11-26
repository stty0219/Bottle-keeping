// 啟動測試：用 jsdom 載入完整的 index.html 與所有 css／js，確認啟動沒有錯誤、不會停在「載入中」，
// 總覽、明細、設定三個分頁都能 render。
// 外部資源（Firebase SDK、Google Fonts）一律回傳空內容：App 會以「僅存於此裝置」模式啟動，不需要網路。
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole, requestInterceptor } = require('jsdom');
const { TODAY, ROOT } = require('./helpers/load-core');
const L = require('./helpers/ledger');

const ORIGIN = 'http://localhost:8000';
const TYPES = { '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };

// 示範帳本：花費型（歸零、留到下個月）、儲蓄型（含目標）、超支墊付、轉移、撥款設定
function sampleLedger() {
  return L.ledger({
    buckets: [
      L.spend('day', '日常', 24000, { coverBy: 'sav' }),
      L.keep('trip', '旅遊', 1000),
      L.save('sav', '儲蓄', 20000, { goal: 100000 }),
      L.save('inv', '投資', 0),
    ],
    excessTo: 'sav', sweepTo: 'sav',
    jarPlan: { J: L.plan('2026-10', [{ m: '2026-10', amt: 1000, src: 'day', coverBy: 'day' }]) },
    txns: [
      L.inc('2026-10-01', 45000), L.exp('2026-10-08', 25500, 'day'), L.exp('2026-10-20', 300, 'trip'),
      L.inc('2026-11-01', 45000), L.exp('2026-11-03', 1200, 'day'), L.xfer('2026-11-05', 5000, 'sav', 'inv'),
    ],
  });
}

async function boot(seed) {
  const problems = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', (...a) => problems.push('console.error: ' + a.join(' ')));
  virtualConsole.on('jsdomError', e => {
    // jsdom 尚未支援的瀏覽器功能（例如 scrollTo）與 CSS 解析的限制，不是 App 的錯誤
    if (e.type === 'not-implemented' || e.type === 'css-parsing') return;
    problems.push(`jsdom ${e.type}: ${e.message} ${e.cause ? e.cause.stack || e.cause : ''}`);
  });

  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: ORIGIN + '/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    resources: {
      interceptors: [requestInterceptor(request => {
        const u = new URL(request.url);
        if (u.origin !== ORIGIN) return new Response('', { status: 200, headers: { 'Content-Type': 'text/plain' } });
        const file = path.join(ROOT, decodeURIComponent(u.pathname));
        if (!file.startsWith(ROOT) || !fs.existsSync(file)) return new Response('not found', { status: 404 });
        return new Response(fs.readFileSync(file), { headers: { 'Content-Type': TYPES[path.extname(file)] || 'text/plain' } });
      })],
    },
    beforeParse(window) {
      // 固定「今天」
      const [y, m, d] = TODAY.split('-').map(Number);
      window.eval(`(()=>{const R=Date,T=new R(${y},${m - 1},${d},12,0,0).getTime();
        class D extends R{constructor(...a){super(...(a.length?a:[T]))}static now(){return T}}window.Date=D;})()`);
      window.addEventListener('error', e => problems.push(`window error: ${e.message} (${e.filename}:${e.lineno})`));
      if (seed) window.localStorage.setItem('fenguan-ledger-v1', JSON.stringify(seed));
    },
  });
  const { window } = dom;
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('index.html 在 10 秒內沒有載入完成')), 10000);
    window.addEventListener('load', () => { clearTimeout(t); resolve(); });
  });
  return { window, problems };
}

// App 自己的錯誤紀錄（config.js 記錄 error／unhandledrejection 與載入失敗的檔案）
const errlog = w => JSON.parse(w.localStorage.getItem('fenguan-errlog') || '[]');
const view = w => w.document.getElementById('view');
const clickTab = (w, t) => w.document.querySelector(`nav.tabs [data-tab="${t}"]`).click();

async function checkBoot(seed, jarCount) {
  const { window: w, problems } = await boot(seed);
  try {
    const doc = w.document;
    assert.equal(doc.getElementById('sync').textContent, '僅存於此裝置', '右上角不應停在「載入中」');
    assert.equal(w.eval('S.buckets.length'), jarCount, '狀態 S 應已建立');

    // 總覽
    assert.equal(doc.querySelectorAll('#view .shelf .jarcol').length, jarCount, '總覽應列出每個罐子');
    assert.equal(doc.querySelector('nav.tabs [data-tab="home"]').getAttribute('aria-current'), 'page');

    // 明細
    clickTab(w, 'list');
    assert.equal(doc.querySelector('nav.tabs [data-tab="list"]').getAttribute('aria-current'), 'page');
    assert.ok(view(w).querySelector('#listResults'), '明細頁應 render');

    // 設定
    clickTab(w, 'settings');
    assert.equal(doc.querySelector('nav.tabs [data-tab="settings"]').getAttribute('aria-current'), 'page');
    assert.ok(view(w).querySelectorAll('.sec').length > 0, '設定頁應 render');

    // 回到總覽
    clickTab(w, 'home');
    assert.equal(doc.querySelectorAll('#view .shelf .jarcol').length, jarCount);

    assert.deepEqual(problems, [], '啟動與切換分頁時不應有錯誤');
    assert.deepEqual(errlog(w), [], 'App 的錯誤紀錄應為空');
  } finally {
    w.close();
  }
}

test('第一次使用（沒有任何資料）：啟動成功，三個分頁都能顯示', async () => {
  await checkBoot(null, 3);                                            // defaults()：投資、日常、彈性
});

test('有資料的帳本：啟動成功，三個分頁都能顯示', async () => {
  await checkBoot(sampleLedger(), 4);
});
