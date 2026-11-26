// 超支墊付（不連鎖），以及撥給共用罐的錢屬於所屬罐子自己的支出（calculation-rules.md 第 2、5 節，#24）
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('../helpers/load-core');
const { assertInvariant } = require('../helpers/invariant');
const { spend, keep, save, inc, exp, ledger, plan, jt, jar } = require('../helpers/ledger');

const c = loadCore();

describe('個人罐子的超支墊付', () => {
  test('日常每月 24,000 花了 26,000：日常 $0 並標示超支 2,000，儲蓄少 2,000', () => {
    c.setState(ledger({
      buckets: [spend('day', '日常', 24000, { coverBy: 'sav' }), save('sav', '儲蓄', 20000)], excessTo: 'sav', sweepTo: 'sav',
      txns: [inc('2026-11-01', 44000), exp('2026-11-10', 26000, 'day')],
    }));
    const st = c.stats();
    assert.equal(st.day.bal, 0);
    assert.equal(st.day.short, 2000);
    assert.equal(st.day.over, 2000);
    assert.equal(st.day.coveredBy, 'sav');
    assert.equal(st.sav.bal, 18000);
    assert.equal(st.sav.covered, 2000);
    assert.deepEqual(st.sav.coverParts, [{ id: 'day', amount: 2000 }]);
    assertInvariant(c, '2026-11');
  });

  // 日常 → 彈性墊付；彈性 → 儲蓄墊付
  const chain = txns => c.setState(ledger({
    buckets: [spend('day', '日常', 24000, { coverBy: 'flex' }), spend('flex', '彈性', 1000, { coverBy: 'sav' }), save('sav', '儲蓄', 20000)],
    excessTo: 'sav', sweepTo: 'sav', txns: [inc('2026-11-01', 45000), ...txns],
  }));

  test('不連鎖：彈性替日常墊付 3,000 後變成 −2,000，維持負數，不再由儲蓄墊付', () => {
    chain([exp('2026-11-10', 27000, 'day')]);
    const st = c.stats();
    assert.equal(st.day.bal, 0);
    assert.equal(st.day.over, 3000);
    assert.equal(st.day.coveredBy, 'flex');
    assert.equal(st.flex.bal, -2000);
    assert.equal(st.flex.short, 0);
    assert.equal(st.flex.covered, 3000);
    assert.equal(st.sav.bal, 20000);
    assert.equal(st.sav.covered, 0);
    assertInvariant(c, '2026-11');
  });

  test('墊付罐子自己原本的不足，仍由它的 coverBy 墊付', () => {
    // 彈性自己花 1,500（不足 500），又替日常墊付 3,000
    chain([exp('2026-11-10', 27000, 'day'), exp('2026-11-11', 1500, 'flex')]);
    const st = c.stats();
    assert.equal(st.flex.short, 500);
    assert.equal(st.flex.over, 500);
    assert.equal(st.flex.coveredBy, 'sav');
    assert.equal(st.flex.bal, -3000);                                  // −500 − 3,000 + 500
    assert.equal(st.sav.bal, 19500);
    assertInvariant(c, '2026-11');
  });

  test('沒有 coverBy、會結轉的罐子：負數帶到下個月', () => {
    c.setState(ledger({
      buckets: [keep('trip', '旅遊', 1000), save('sav', '儲蓄', 20000)], excessTo: 'sav', sweepTo: 'sav',
      txns: [inc('2026-10-01', 21000), exp('2026-10-10', 2000, 'trip')],
    }));
    assert.equal(c.stats('2026-10').trip.bal, -1000);
    assert.equal(c.stats('2026-10').trip.over, 0);
    assert.equal(c.stats('2026-11').trip.open, -1000);
    assertInvariant(c, '2026-11');
  });
});

describe('#24 共用罐的撥款與墊付屬於所屬罐子自己的支出', () => {
  // 日常（月底歸零，計畫 24,000，coverBy 儲蓄，美樂蒂屬於日常，每月撥款 1,000）
  // 彈性（月底歸零，計畫 6,000，coverBy 日常）、儲蓄（儲蓄型）
  const setup = (txns, myCover) => c.setState(ledger({
    buckets: [
      spend('day', '日常', 24000, { coverBy: 'sav' }),
      spend('flex', '彈性', 6000, { coverBy: 'day' }),
      save('sav', '儲蓄', 0),
    ],
    excessTo: 'sav', sweepTo: 'sav',
    jarPlan: { J: plan('2026-11', [{ m: '2026-11', amt: 1000, src: 'day', coverBy: 'day' }]) },
    txns: [inc('2026-11-01', 30000), ...txns],
  }), {
    user: { uid: 'me' },
    jars: { J: jar(['me', 'other']) },
    jarTxns: { J: [
      ...(myCover ? [jt('J', 'cover', myCover, '2026-11-01', 'me', { srcId: 'day' })] : []),
      jt('J', 'cover', 500, '2026-11-01', 'other', { srcId: 'day' }),   // 對方的份額：不從我的罐子扣
    ] },
  });

  test('情況 A：日常 24,000 − 23,000 − 1,000 − 500 = −500 → 由儲蓄墊付 500，日常 0', () => {
    setup([exp('2026-11-10', 23000, 'day')], 500);
    const st = c.stats();
    assert.equal(st.day.short, 500);
    assert.equal(st.day.bal, 0);
    assert.equal(st.day.over, 500);
    assert.equal(st.day.coveredBy, 'sav');
    assert.equal(st.day.monthOut, 23000);
    assert.equal(st.day.monthJar, 1000);
    assert.equal(st.day.jarCover, 500);
    assert.equal(st.day.jarOut, 1500);
    assert.deepEqual(st.day.jarParts, [{ id: 'sj:J', contrib: 1000, cover: 500, amount: 1500 }]);
    assert.equal(st.sav.bal, -500);
    assert.equal(st.sav.covered, 500);
    assertInvariant(c, '2026-11');
  });

  test('情況 B：日常自己剩 2,500，替彈性墊付 2,000 後剩 500，不觸發儲蓄', () => {
    setup([exp('2026-11-10', 20000, 'day'), exp('2026-11-11', 8000, 'flex')], 500);
    const st = c.stats();
    assert.equal(st.day.short, 0);
    assert.equal(st.day.over, 0);
    assert.equal(st.day.coveredBy, null);
    assert.equal(st.day.covered, 2000);
    assert.equal(st.day.bal, 500);
    assert.equal(st.flex.over, 2000);
    assert.equal(st.flex.coveredBy, 'day');
    assert.equal(st.flex.bal, 0);
    assert.equal(st.sav.bal, 0);
    assert.equal(st.sav.covered, 0);
    assertInvariant(c, '2026-11');
  });

  test('情況 C：日常自己剛好 0，替彈性墊付後 −2,000，維持負數，不由儲蓄墊付', () => {
    setup([exp('2026-11-10', 23000, 'day'), exp('2026-11-11', 8000, 'flex')], 0);
    const st = c.stats();
    assert.equal(st.day.short, 0);
    assert.equal(st.day.coveredBy, null);
    assert.equal(st.day.jarCover, 0);
    assert.equal(st.day.bal, -2000);
    assert.equal(st.sav.bal, 0);
    assert.equal(st.sav.covered, 0);
    assertInvariant(c, '2026-11');
    // 日常是月底歸零：這 −2,000 在下個月月初結算進儲蓄
    const dec = c.stats('2026-12');
    assert.equal(dec.day.open, 0);
    assert.equal(dec.sav.open, -2000);
    assert.deepEqual(dec.sav.sweepParts, [{ id: 'day', amount: -2000 }]);
    assertInvariant(c, '2026-12');
  });
});
