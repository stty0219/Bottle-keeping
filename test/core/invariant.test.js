// 不變量：任何情境下，所有個人罐子的總金額加總 = 實際的收入 − 支出 − 撥給共用罐的錢。
// 各情境的測試檔已經逐一檢查；這裡再用固定種子產生 200 組隨機帳本，每次執行的結果都相同。
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('../helpers/load-core');
const { assertInvariant } = require('../helpers/invariant');
const { ledger } = require('../helpers/ledger');

const c = loadCore();
const MONTHS = ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];

// mulberry32：固定種子的亂數
function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomCase(seed) {
  const r = rng(seed);
  const int = (a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = a => a[Math.floor(r() * a.length)];
  const day = mk => `${mk}-${String(int(1, 28)).padStart(2, '0')}`;

  const n = int(2, 5);
  const buckets = [];
  for (let i = 0; i < n; i++) {
    const kind = i === n - 1 || r() < 0.4 ? 'save' : 'spend';         // 至少一個儲蓄型
    buckets.push({ id: `b${i}`, name: `罐${i}`, kind, carry: kind === 'save' || r() < 0.4, amt: pick([0, 500, 1000, 3000, 8000, 20000]), coverBy: null, color: '#1F7A80' });
  }
  for (const b of buckets) if (r() < 0.6) { const o = pick(buckets); if (o.id !== b.id) b.coverBy = o.id; }
  const saves = buckets.filter(b => b.kind === 'save');
  const ids = buckets.map(b => b.id);

  const txns = [];
  let k = 0;
  for (const mk of MONTHS) {
    if (mk === '2026-12' && r() < 0.5) continue;                       // 有時有提前記帳的月份
    for (let i = int(0, 3); i > 0; i--) txns.push({ id: `t${k++}`, type: 'income', mode: 'pct', amount: int(1, 60000), date: day(mk) });
    for (let i = int(0, 2); i > 0; i--) txns.push({ id: `t${k++}`, type: 'income', mode: 'one', target: pick(ids), amount: int(1, 20000), date: day(mk) });
    for (let i = int(0, 8); i > 0; i--) txns.push({ id: `t${k++}`, type: 'expense', bucketId: pick(ids), catId: null, amount: int(1, 15000), date: day(mk) });
    for (let i = int(0, 3); i > 0; i--) {
      const from = pick(ids), to = pick(ids);
      if (from !== to) txns.push({ id: `t${k++}`, type: 'transfer', from, to, amount: int(1, 10000), date: day(mk) });
    }
  }

  // 共用罐：撥款設定（可能中途修改金額或所屬罐子、可能已退出），以及自己與對方寫入的超支份額
  const jarPlan = {}, jars = {}, jarTxns = {};
  for (let j = int(0, 2); j > 0; j--) {
    const jid = `J${j}`, from = pick(MONTHS.slice(0, 3));
    const hist = [{ m: from, amt: pick([0, 500, 1000, 2000]), src: pick(ids), coverBy: null }];
    if (r() < 0.5) hist.push({ m: pick(MONTHS.filter(m => m > from)), amt: pick([0, 800, 1500]), src: pick(ids), coverBy: null });
    hist.sort((a, b) => (a.m < b.m ? -1 : 1));
    jarPlan[jid] = { from, hist, name: `共用${j}`, ...(r() < 0.2 ? { until: '2026-11' } : {}) };
    jars[jid] = { name: `共用${j}`, members: ['me', 'other'], memberInfo: {}, categories: [] };
    jarTxns[jid] = [];
    for (const mk of MONTHS) if (r() < 0.4) {
      jarTxns[jid].push({ id: `c${k++}`, jid, kind: 'cover', amount: int(1, 3000), date: `${mk}-01`, by: r() < 0.7 ? 'me' : 'other', srcId: pick([...ids, 'deleted']) });
    }
  }

  return {
    state: ledger({ buckets, txns, excessTo: pick(saves).id, sweepTo: pick(saves).id, jarPlan }),
    cloud: { user: { uid: 'me' }, jars, jarTxns },
  };
}

test('200 組隨機帳本：每個月份的罐子合計都等於實際剩下的錢', () => {
  let checked = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const { state, cloud } = randomCase(seed);
    c.setState(state, cloud);
    for (const mk of MONTHS) { assertInvariant(c, mk, `（seed ${seed}）`); checked++; }
  }
  assert.equal(checked, 1000);
});

test('收入不足計畫時，分配的合計剛好等於收入（不因四捨五入多或少）', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const { state } = randomCase(seed);
    c.setState(state);
    const r = rng(seed * 7919);
    const T = 1 + Math.floor(r() * 80000);
    const a = c.call('planAlloc', T, '2026-11');
    assert.equal(Object.values(a).reduce((x, y) => x + y, 0), T, `seed ${seed}，T = ${T}`);
  }
});
