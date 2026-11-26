// 花費型：月底歸零（結算進 sweepTo）與留到下個月（calculation-rules.md 第 2、8 節）
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('../helpers/load-core');
const { assertInvariant } = require('../helpers/invariant');
const { spend, keep, save, inc, incTo, exp, ledger } = require('../helpers/ledger');

const c = loadCore();

// 日常（花費型、月底歸零、不墊付）每月 24,000；儲蓄（sweepTo）每月 20,000；上月收入 44,000
const resetLedger = txns => c.setState(ledger({
  buckets: [spend('day', '日常', 24000), save('sav', '儲蓄', 20000)], excessTo: 'sav', sweepTo: 'sav',
  txns: [inc('2026-10-01', 44000), ...txns],
}));

test('月底歸零：上月剩下的 4,000 結算進儲蓄', () => {
  resetLedger([exp('2026-10-10', 20000, 'day'), inc('2026-11-01', 44000)]);
  const st = c.stats('2026-11');
  assert.equal(st.day.open, 0);
  assert.equal(st.sav.open, 24000);                                   // 20,000 + 結算進來的 4,000
  assert.equal(st.sav.sweep, 4000);
  assert.deepEqual(st.sav.sweepParts, [{ id: 'day', amount: 4000 }]);
  assert.equal(st.sav.sweepMonth, '2026-10');
  assert.equal(st.sav.monthIn, 20000);                                // 結算進來的錢不算本月存入
  assertInvariant(c, '2026-10'); assertInvariant(c, '2026-11');
});

test('月底歸零：上月不足 2,000，結算進儲蓄（負數）', () => {
  resetLedger([exp('2026-10-10', 26000, 'day')]);
  const st = c.stats('2026-11');
  assert.equal(st.day.open, 0);
  assert.equal(st.sav.open, 18000);
  assert.equal(st.sav.sweep, -2000);
  assert.deepEqual(st.sav.sweepParts, [{ id: 'day', amount: -2000 }]);
  assertInvariant(c, '2026-11');
});

test('目標月份本身不做月底結算', () => {
  resetLedger([inc('2026-11-01', 44000), exp('2026-11-10', 20000, 'day')]);
  const st = c.stats('2026-11');
  assert.equal(st.day.bal, 4000);
  assert.equal(st.sav.bal, 64000);                                    // 上月 20,000 + 上月日常結算 24,000 + 本月 20,000
  assertInvariant(c, '2026-11');
});

test('月底歸零的水位 = bal ÷（max(0, open) + monthIn）', () => {
  resetLedger([inc('2026-11-01', 44000), exp('2026-11-10', 6000, 'day')]);
  const lv = c.call('spendLevel', c.stats('2026-11').day);
  assert.equal(lv.ratio, 18000 / 24000);
});

test('留到下個月：每月 1,000、上月留下 4,000、本月花 2,000 → 可用 3,000、水位 60%', () => {
  c.setState(ledger({
    buckets: [keep('trip', '旅遊', 1000), save('sav', '儲蓄', 20000)], excessTo: 'sav', sweepTo: 'sav',
    txns: [
      inc('2026-10-01', 21000), incTo('2026-10-02', 3000, 'trip'),    // 上月：分到 1,000 + 另外放入 3,000
      inc('2026-11-01', 21000), exp('2026-11-12', 2000, 'trip'),
    ],
  }));
  const s = c.stats('2026-11').trip;
  assert.equal(s.open, 4000);
  assert.equal(s.monthIn, 1000);
  assert.equal(s.monthOut, 2000);
  assert.equal(s.bal, 3000);
  assert.equal(c.call('spendLevel', s).ratio, 0.6);
  assert.equal(c.call('money', s.bal), '$3,000');
  // 留到下個月的罐子不結算進 sweepTo
  assert.equal(c.stats('2026-12').trip.open, 3000);
  assertInvariant(c, '2026-11'); assertInvariant(c, '2026-12');
});
