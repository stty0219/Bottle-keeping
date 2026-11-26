// 計畫分配（calculation-rules.md 第 1 節）
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('../helpers/load-core');
const { assertInvariant } = require('../helpers/invariant');
const { spend, keep, save, inc, incTo, ledger } = require('../helpers/ledger');

const c = loadCore();
// 日常 24,000、旅遊 1,000、儲蓄 20,000、投資 0；計畫合計 P = 45,000
const buckets = () => [
  spend('day', '日常', 24000, { coverBy: 'sav' }),
  keep('trip', '旅遊', 1000),
  save('sav', '儲蓄', 20000),
  save('inv', '投資', 0),
];
const setup = (txns, o = {}) => c.setState(ledger({ buckets: buckets(), excessTo: 'sav', sweepTo: 'sav', txns, ...o }));
const monthIn = () => { const st = c.stats(); return Object.fromEntries(Object.entries(st).map(([k, s]) => [k, s.monthIn])); };

test('收入等於計畫：每個罐子拿到自己的每月金額', () => {
  setup([inc('2026-11-05', 45000)]);
  assert.deepEqual(monthIn(), { day: 24000, trip: 1000, sav: 20000, inv: 0 });
  assertInvariant(c, '2026-11');
});

test('收入超過計畫：多出的 5,000 放入 excessTo（儲蓄）', () => {
  setup([inc('2026-11-05', 50000)]);
  assert.deepEqual(monthIn(), { day: 24000, trip: 1000, sav: 25000, inv: 0 });
  assertInvariant(c, '2026-11');
});

test('收入不足計畫：依每月金額等比例分配，最後一個罐子拿零頭', () => {
  setup([inc('2026-11-05', 30000)]);
  // 日常 30,000×24/45 = 16,000；旅遊 30,000×1/45 ≈ 666.67 → 667；儲蓄拿剩下的 13,333
  assert.deepEqual(monthIn(), { day: 16000, trip: 667, sav: 13333, inv: 0 });
  assertInvariant(c, '2026-11');
});

test('同一個月的計畫收入先加總再分配', () => {
  setup([inc('2026-11-05', 20000), inc('2026-11-20', 25000)]);
  assert.equal(c.call('planTotals')['2026-11'], 45000);
  assert.deepEqual(monthIn(), { day: 24000, trip: 1000, sav: 20000, inv: 0 });
});

test('單筆收入的分配 = 當月分配結果 × 這筆 ÷ 當月合計（只用於顯示）', () => {
  const a = inc('2026-11-05', 30000);
  setup([a, inc('2026-11-20', 15000)]);
  assert.deepEqual(c.call('incAlloc', a), { day: 16000, trip: 667, sav: 13333, inv: 0 });
});

test('全部放入一罐：整筆放入指定罐子，不參與計畫', () => {
  setup([inc('2026-11-05', 45000), incTo('2026-11-10', 10000, 'inv')]);
  assert.deepEqual(monthIn(), { day: 24000, trip: 1000, sav: 20000, inv: 10000 });
  assertInvariant(c, '2026-11');
});

test('沒有設定任何每月金額（P = 0）：全部放入 excessTo', () => {
  c.setState(ledger({
    buckets: [spend('day', '日常', 0), save('sav', '儲蓄', 0)], excessTo: 'sav', sweepTo: 'sav',
    txns: [inc('2026-11-05', 30000)],
  }));
  assert.deepEqual(monthIn(), { day: 0, sav: 30000 });
});

test('excessTo 找不到時，退回最後一個儲蓄型罐子', () => {
  setup([inc('2026-11-05', 50000)], { excessTo: 'gone' });
  assert.deepEqual(monthIn(), { day: 24000, trip: 1000, sav: 20000, inv: 5000 });
  assertInvariant(c, '2026-11');
});
