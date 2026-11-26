// 舊資料轉換：比例模式 → 每月金額、remainderId → excessTo／sweepTo、結轉／歸零 → 儲蓄型／花費型
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('../helpers/load-core');
const { assertInvariant } = require('../helpers/invariant');
const { inc, incTo, exp, xfer, ledger } = require('../helpers/ledger');

const c = loadCore();
const byId = () => Object.fromEntries(c.state().buckets.map(b => [b.id, b]));
// v43 以前的罐子：沒有 kind，只有 carry
const old = (id, name, o) => ({ id, name, color: '#1F7A80', ...o });

describe('migrateAlloc（v26：比例分配 → 每月金額）', () => {
  const pctLedger = (pcts, T) => ledger({
    allocMode: 'pct', excessTo: undefined, sweepTo: undefined,
    buckets: [old('inv', '投資', { pct: pcts[0] }), old('day', '日常', { pct: pcts[1], carry: false }), old('flex', '彈性', { pct: pcts[2] })],
    txns: [inc('2026-09-01', 30000), inc('2026-10-01', T)],
  });

  test('比例 30／50／20、最後一個月收入 40,000 → 12,000／20,000／8,000', () => {
    c.setState(pctLedger([30, 50, 20], 40000));
    assert.equal(c.run('migrateAlloc()'), true);
    const b = byId();
    assert.deepEqual([b.inv.amt, b.day.amt, b.flex.amt], [12000, 20000, 8000]);
    assert.equal(c.state().allocMode, 'amount');
    assert.equal(c.state().remainderId, 'flex');                       // 名稱有「彈性」的罐子
  });

  test('金額取整到百位：比例 33／33／34、收入 45,000 → 14,900／14,900／15,300', () => {
    c.setState(pctLedger([33, 33, 34], 45000));
    c.run('migrateAlloc()');
    const b = byId();
    assert.deepEqual([b.inv.amt, b.day.amt, b.flex.amt], [14900, 14900, 15300]);
  });

  test('已經是每月金額模式時不轉換', () => {
    c.setState(ledger({ buckets: [old('day', '日常', { amt: 1000, kind: 'spend', carry: false })] }));
    assert.equal(c.run('migrateAlloc()'), false);
  });
});

describe('migrateCover（v32：remainderId → excessTo、sweepTo 與 coverBy）', () => {
  test('沒有 excessTo、sweepTo 時，由 remainderId 轉換；歸零罐子由它墊付', () => {
    c.setState(ledger({
      excessTo: null, sweepTo: null, remainderId: 'flex',
      buckets: [
        old('day', '日常', { amt: 24000, carry: false }),
        old('rent', '房租', { amt: 10000, carry: false }),
        old('inv', '投資', { amt: 5000, carry: true, coverBy: 'day' }),
        old('flex', '彈性', { amt: 6000, carry: true }),
      ],
    }));
    assert.equal(c.run('migrateCover()'), true);
    const S = c.state(), b = byId();
    assert.equal(S.excessTo, 'flex');
    assert.equal(S.sweepTo, 'flex');
    assert.equal(b.day.coverBy, 'flex');
    assert.equal(b.rent.coverBy, 'flex');
    assert.equal(b.inv.coverBy, null);                                 // 會結轉的罐子不墊付
    assert.equal(b.flex.coverBy, null);
  });

  test('清除無效的 coverBy（指向自己或不存在的罐子）、excessTo、sweepTo', () => {
    c.setState(ledger({
      excessTo: 'gone', sweepTo: 'sav',
      buckets: [
        old('day', '日常', { kind: 'spend', carry: false, coverBy: 'day' }),
        old('trip', '旅遊', { kind: 'spend', carry: true, coverBy: 'gone' }),
        old('sav', '儲蓄', { kind: 'save', carry: true }),
        old('inv', '投資', { kind: 'save', carry: true }),
      ],
    }));
    assert.equal(c.run('migrateCover()'), true);
    const b = byId();
    assert.equal(b.day.coverBy, null);
    assert.equal(b.trip.coverBy, null);
    assert.equal(c.state().excessTo, 'inv');                           // 退回最後一個儲蓄型罐子
    assert.equal(c.state().sweepTo, 'sav');
  });
});

describe('migrateKind（v43：結轉／歸零 → 儲蓄型／花費型）', () => {
  const pre = () => ledger({
    excessTo: 'flex', sweepTo: 'flex', kindV43: false, kindNote: false,
    buckets: [
      old('inv', '投資', { amt: 5000 }),                                // carry 未設定 → 會結轉
      old('day', '日常', { amt: 24000, carry: false, coverBy: 'flex' }),
      old('trip', '旅遊', { amt: 1000, carry: true }),
      old('flex', '彈性', { amt: 6000, carry: false }),                // 是 sweepTo，所以實際上會結轉
    ],
    txns: [
      inc('2026-09-01', 36000), exp('2026-09-10', 25000, 'day'), xfer('2026-09-20', 3000, 'inv', 'trip'),
      inc('2026-10-01', 40000), exp('2026-10-10', 20000, 'day'), exp('2026-10-11', 1500, 'trip'), xfer('2026-10-20', 2000, 'day', 'inv'),
      incTo('2026-11-01', 8000, 'flex'), inc('2026-11-02', 36000), exp('2026-11-03', 30000, 'day'), xfer('2026-11-04', 4000, 'flex', 'inv'),
    ],
  });
  const snap = () => ['2026-09', '2026-10', '2026-11', '2026-12'].map(mk =>
    Object.fromEntries(Object.entries(c.stats(mk)).map(([id, s]) => [id, { open: s.open, bal: s.bal, short: s.short, over: s.over }])));

  test('會結轉 → 儲蓄型、月底歸零 → 花費型；excessTo／sweepTo 指定的罐子 → 儲蓄型', () => {
    c.setState(pre());
    assert.equal(c.run('migrateKind()'), true);
    const b = byId();
    assert.deepEqual([b.inv.kind, b.inv.carry], ['save', true]);
    assert.deepEqual([b.day.kind, b.day.carry], ['spend', false]);
    assert.deepEqual([b.trip.kind, b.trip.carry], ['save', true]);
    assert.deepEqual([b.flex.kind, b.flex.carry], ['save', true]);
    assert.equal(c.state().kindV43, true);
    assert.equal(c.state().kindNote, true);
  });

  test('已有類型時：儲蓄型的 carry 改回 true；被指定為 sweepTo 的花費型改為儲蓄型', () => {
    c.setState(ledger({
      excessTo: 'sav', sweepTo: 'pin',
      buckets: [old('sav', '儲蓄', { kind: 'save', carry: false }), old('pin', '彈性', { kind: 'spend', carry: false }), old('day', '日常', { kind: 'spend', carry: true })],
    }));
    c.run('migrateKind()');
    const b = byId();
    assert.equal(b.sav.carry, true);
    assert.deepEqual([b.pin.kind, b.pin.carry], ['save', true]);
    assert.deepEqual([b.day.kind, b.day.carry], ['spend', true]);       // 留到下個月的花費型不變
  });

  test('轉換前後，每個月份每個罐子的 bal 完全一致', () => {
    c.setState(pre());
    const before = snap();
    c.run('migrateKind()');
    c.run('planCache=null;horizonCache=null');
    assert.deepEqual(snap(), before);
    for (const mk of ['2026-09', '2026-10', '2026-11', '2026-12']) assertInvariant(c, mk);
  });
});
