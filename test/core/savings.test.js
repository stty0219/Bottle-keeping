// 儲蓄型：本月淨存、轉移、沒有每月分配的罐子（#30）、目標金額（calculation-rules.md 第 2、8 節）
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('../helpers/load-core');
const { assertInvariant } = require('../helpers/invariant');
const { spend, keep, save, inc, incTo, exp, xfer, ledger } = require('../helpers/ledger');

const c = loadCore();

// docs 驗算範例：儲蓄上月帶過來 18,802、本月存入 20,000、替日常墊付 1,427、轉出 18,646 到投資
const docsExample = (goal, more = []) => c.setState(ledger({
  buckets: [
    spend('day', '日常', 24000, { coverBy: 'sav' }),
    save('sav', '儲蓄', 20000, goal ? { goal } : {}),
    save('inv', '投資', 0),
  ],
  excessTo: 'sav', sweepTo: 'sav',
  txns: [
    incTo('2026-10-01', 18802, 'sav'),
    inc('2026-11-01', 44000),
    exp('2026-11-10', 25427, 'day'),                                  // 日常超支 1,427，由儲蓄墊付
    xfer('2026-11-20', 18646, 'sav', 'inv'),
    ...more,
  ],
}));

describe('儲蓄型的本月淨存', () => {
  test('本月淨存 = 存入 − 墊付 − 支出；轉出不計入：淨存 18,573、累積 18,729', () => {
    docsExample();
    const s = c.stats().sav;
    assert.equal(s.open, 18802);
    assert.equal(s.monthIn, 20000);
    assert.equal(s.covered, 1427);
    assert.equal(s.monthOut, 0);
    assert.equal(s.xferOut, 18646);
    assert.equal(s.bal, 18729);
    const v = c.call('saveView', s);
    assert.equal(v.net, 18573);
    assert.equal(v.ratio, 18729 / 38802);                              // ≈ 48%
    assert.equal(Math.round(v.ratio * 100), 48);
    assert.equal(c.call('saveSub', v), '本月淨存 $18,573');
    assertInvariant(c, '2026-11');
  });

  test('只有轉入的儲蓄型（投資）：說明「本月轉入 $18,646」、水位 100%', () => {
    docsExample();
    const s = c.stats().inv;
    assert.equal(s.monthIn, 0);
    assert.equal(s.xferIn, 18646);
    assert.equal(s.bal, 18646);
    const v = c.call('saveView', s);
    assert.equal(v.active, false);
    assert.equal(v.ratio, 1);
    assert.equal(c.call('saveSub', v), '本月轉入 $18,646');
  });

  test('儲蓄型自己的支出與撥給共用罐的錢計入本月支出', () => {
    docsExample(null, [exp('2026-11-21', 3000, 'sav')]);
    const s = c.stats().sav;
    const v = c.call('saveView', s);
    assert.equal(v.spent, 3000);
    assert.equal(v.net, 20000 - 1427 - 3000);
    assert.equal(s.bal, 18729 - 3000);
    assertInvariant(c, '2026-11');
  });
});

describe('轉移（v40 的兩個情況，依 v43 的現行規則）', () => {
  // 儲蓄上月帶過來 24,905，本月存入 20,000，沒有支出
  const v40 = out => c.setState(ledger({
    buckets: [save('sav', '儲蓄', 20000), save('inv', '投資', 0)], excessTo: 'sav', sweepTo: 'sav',
    txns: [incTo('2026-10-01', 24905, 'sav'), inc('2026-11-01', 20000), xfer('2026-11-15', out, 'sav', 'inv')],
  }));

  test('轉出 10,000（少於上月帶過來的錢）：本月淨存 20,000、累積 34,905', () => {
    v40(10000);
    const s = c.stats().sav, v = c.call('saveView', s);
    assert.equal(v.net, 20000);
    assert.equal(s.bal, 34905);
    assert.equal(s.xferOut, 10000);
    assert.equal(v.ratio, 34905 / 44905);                              // ≈ 77.7% → 78%
    assert.equal(Math.round(v.ratio * 100), 78);
    assert.equal(c.call('saveSub', v), '本月淨存 $20,000');
    assertInvariant(c, '2026-11');
  });

  test('轉出 30,000（多於上月帶過來的錢）：本月淨存仍是 20,000、累積 14,905', () => {
    v40(30000);
    const s = c.stats().sav, v = c.call('saveView', s);
    assert.equal(v.net, 20000);
    assert.equal(s.bal, 14905);
    assert.equal(v.ratio, 14905 / 44905);                              // ≈ 33.2% → 33%
    assert.equal(Math.round(v.ratio * 100), 33);
    assert.equal(c.call('saveSub', v), '本月淨存 $20,000');
    // 轉入方：計入累積，不算本月存入
    const inv = c.stats().inv;
    assert.equal(inv.xferIn, 30000);
    assert.equal(inv.monthIn, 0);
    assert.equal(inv.bal, 30000);
    assertInvariant(c, '2026-11');
  });

  test('花費型轉入儲蓄型：花費型算在本月；儲蓄型只計入轉入，不影響本月淨存', () => {
    c.setState(ledger({
      buckets: [spend('day', '日常', 24000), keep('trip', '旅遊', 1000), save('sav', '儲蓄', 20000)], excessTo: 'sav', sweepTo: 'sav',
      txns: [inc('2026-11-01', 45000), xfer('2026-11-05', 1000, 'day', 'sav'), xfer('2026-11-06', 500, 'trip', 'sav')],
    }));
    const st = c.stats();
    assert.equal(st.day.monthOut, 1000);
    assert.equal(st.day.xferOut, 0);
    assert.equal(st.trip.monthOut, 500);                               // 留到下個月的花費型也算在本月
    assert.equal(st.trip.xferOut, 0);
    assert.equal(st.sav.monthIn, 20000);
    assert.equal(st.sav.xferIn, 1500);
    assert.equal(st.sav.bal, 21500);
    assert.equal(c.call('saveView', st.sav).net, 20000);
    assertInvariant(c, '2026-11');
  });
});

describe('#30 沒有每月分配的儲蓄型罐子', () => {
  test('轉入的下個月沒有變動：說明「累積中」、水位 100%', () => {
    docsExample();
    const s = c.stats('2026-12').inv, v = c.call('saveView', s);
    assert.equal(s.open, 18646);
    assert.equal(s.bal, 18646);
    assert.equal(v.ratio, 1);
    assert.equal(v.empty, false);
    assert.equal(c.call('saveSub', v), '累積中');
  });

  test('下個月記一筆虧損 2,000：紅字「本月淨減 $2,000」、水位 16,646 ÷ 18,646 ≈ 89%', () => {
    docsExample(null, [exp('2026-12-05', 2000, 'inv')]);
    const s = c.stats('2026-12').inv, v = c.call('saveView', s);
    assert.equal(v.net, -2000);
    assert.equal(s.bal, 16646);
    assert.equal(c.call('saveSub', v), '本月淨減 $2,000');
    assert.equal(v.ratio, 16646 / 18646);
    assert.equal(Math.round(v.ratio * 100), 89);
    assertInvariant(c, '2026-12');
  });
});

describe('目標金額（v44）', () => {
  const sav = goal => save('sav', '儲蓄', 20000, { goal });

  test('累積 18,729、目標 100,000：🎯 19%，還差 81,271', () => {
    const g = c.call('goalView', sav(100000), 18729);
    assert.equal(g.reached, false);
    assert.equal(g.pct, 19);
    assert.equal(g.label, '🎯 19%');
    assert.equal(g.left, 81271);
    assert.equal(c.call('goalLine', g, 18729), '累積 $18,729 ／ 目標 $100,000，還差 $81,271');
  });

  test('目標 15,000：已達成，🎉 100%', () => {
    const g = c.call('goalView', sav(15000), 18729);
    assert.equal(g.reached, true);
    assert.equal(g.ratio, 1);
    assert.equal(g.label, '🎉 100%');
    assert.equal(c.call('goalLine', g, 18729), '累積 $18,729 ／ 🎉 已達成目標 $15,000');
  });

  test('剛好等於目標算達成；差一點時最多顯示 99%', () => {
    assert.equal(c.call('goalView', sav(100000), 100000).reached, true);
    const g = c.call('goalView', sav(100000), 99600);
    assert.equal(g.reached, false);
    assert.equal(g.label, '🎯 99%');
  });

  test('累積為負數時水位 0%；花費型的目標不使用；沒有目標時為 null', () => {
    assert.equal(c.call('goalView', sav(100000), -500).ratio, 0);
    assert.equal(c.call('goalView', spend('day', '日常', 24000, { goal: 5000 }), 1000), null);
    assert.equal(c.call('goalView', save('sav', '儲蓄', 20000), 1000), null);
  });

  test('設定目標前後，所有罐子的 bal 完全不變', () => {
    docsExample();
    const before = c.stats();
    docsExample(100000);
    assert.deepEqual(c.stats(), before);
  });

  test('達成提示：第一次達成提示一次並記下 goalReachedAt，之後不再提示；掉回目標以下時清除', () => {
    docsExample(15000);                                               // 本月累積 18,729
    c.run('checkGoals()');
    assert.deepEqual(c.toasts, ['儲蓄已達成目標 $15,000！']);
    assert.ok(c.state().buckets.find(b => b.id === 'sav').goalReachedAt > 0);
    c.run('checkGoals()');
    assert.equal(c.toasts.length, 1);
    // 目標改成 20,000（累積 18,729 未達成）且留有舊的 goalReachedAt：清除，不提示
    c.run("bucketById('sav').goal=20000");
    c.run('checkGoals()');
    assert.equal(c.toasts.length, 1);
    assert.equal(c.state().buckets.find(b => b.id === 'sav').goalReachedAt, null);
  });
});
