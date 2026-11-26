// 共用罐：撥款設定、撥款期間、超支依人數平分（calculation-rules.md 第 4、5 節，v33）
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('../helpers/load-core');
const { assertInvariant } = require('../helpers/invariant');
const { spend, save, inc, exp, ledger, plan, jt, jar } = require('../helpers/ledger');

const c = loadCore();
const buckets = () => [spend('day', '日常', 24000, { coverBy: 'sav' }), save('sav', '儲蓄', 20000)];
const monthJar = (mk, id = 'day') => c.stats(mk)[id].monthJar;

describe('每月撥款', () => {
  // 美樂蒂從 9 月起每月撥款 2,000，屬於日常
  const setup = (txns = [], o = {}) => c.setState(ledger({
    buckets: buckets(), excessTo: 'sav', sweepTo: 'sav',
    jarPlan: { J: plan('2026-09', [{ m: '2026-09', amt: 2000, src: 'day', coverBy: 'day' }], o) },
    txns: [inc('2026-09-01', 44000), inc('2026-10-01', 44000), inc('2026-11-01', 44000), ...txns],
  }), { user: { uid: 'me' }, jars: { J: jar(['me', 'other']) }, jarTxns: { J: [] } });

  test('修改撥款金額從當月（11 月）起生效，過去月份不變', () => {
    setup();
    c.run("setJarPlan('J','amt',3000)");
    assert.deepEqual(c.state().jarPlan.J.hist, [
      { m: '2026-09', amt: 2000, src: 'day', coverBy: 'day' },
      { m: '2026-11', amt: 3000, src: 'day', coverBy: 'day' },
    ]);
    assert.equal(monthJar('2026-09'), 2000);
    assert.equal(monthJar('2026-10'), 2000);
    assert.equal(monthJar('2026-11'), 3000);
    // 同一個月再改一次：更新同一筆，不新增
    c.run("setJarPlan('J','amt',2500)");
    assert.equal(c.state().jarPlan.J.hist.length, 2);
    assert.equal(monthJar('2026-11'), 2500);
    assertInvariant(c, '2026-11');
  });

  test('修改所屬罐子時 coverBy 一起改；過去月份仍由原本的罐子撥款', () => {
    setup();
    c.run("setJarPlan('J','src','sav')");
    assert.deepEqual(c.state().jarPlan.J.hist[1], { m: '2026-11', amt: 2000, src: 'sav', coverBy: 'sav' });
    assert.equal(monthJar('2026-10', 'day'), 2000);
    assert.equal(monthJar('2026-11', 'day'), 0);
    assert.equal(monthJar('2026-11', 'sav'), 2000);
    assertInvariant(c, '2026-11');
  });

  test('撥款計算到可切換的最遠月份：沒有未來紀錄時 12 月不撥款', () => {
    setup();
    assert.equal(c.run('horizon()'), '2026-11');
    assert.equal(monthJar('2026-12'), 0);
    assertInvariant(c, '2026-12');
  });

  test('有 2027-01 的紀錄時，撥款算到 2027-01，2 月不撥款', () => {
    setup([exp('2027-01-10', 100, 'day')]);
    assert.equal(c.run('horizon()'), '2027-01');
    assert.equal(monthJar('2026-12'), 2000);
    assert.equal(monthJar('2027-01'), 2000);
    assert.equal(monthJar('2027-02'), 0);
    assertInvariant(c, '2027-02');
  });

  test('不再是成員（until）的月份起不撥款', () => {
    setup([], { until: '2026-11' });
    assert.equal(monthJar('2026-10'), 2000);
    assert.equal(monthJar('2026-11'), 0);
    assertInvariant(c, '2026-11');
  });
});

describe('v33 共用罐超支平分', () => {
  // 兩人共用罐，上月（10 月）餘額 0。10 月兩人各撥款 1,000，共用支出 4,000。
  // 你的美樂蒂屬於日常（由日常墊付），對方沒有設定墊付。
  const oct = () => [
    jt('J', 'contrib', 1000, '2026-10-01', 'me', { srcId: 'day' }),
    jt('J', 'contrib', 1000, '2026-10-01', 'other'),
    jt('J', 'expense', 4000, '2026-10-12', 'other'),
    jt('J', 'cover', 1000, '2026-10-01', 'me', { srcId: 'day' }),
  ];
  const setup = (nov = []) => c.setState(ledger({
    buckets: buckets(), excessTo: 'sav', sweepTo: 'sav',
    jarPlan: { J: plan('2026-10', [{ m: '2026-10', amt: 1000, src: 'day', coverBy: 'day' }]) },
    txns: [inc('2026-10-01', 44000), inc('2026-11-01', 44000)],
  }), { user: { uid: 'me', displayName: '我' }, jars: { J: jar(['me', 'other']) }, jarTxns: { J: [...oct(), ...nov] } });

  test('B = −2,000，新超支 2,000，每人 1,000；對方尚未墊付 1,000，共用罐 −1,000', () => {
    setup();
    const o = c.call('jarOver', 'J', '2026-10');
    assert.equal(o.over, 2000);
    assert.equal(o.n, 2);
    assert.equal(o.share, 1000);
    assert.deepEqual(o.paid, { me: 1000 });
    assert.deepEqual(o.unpaid, [{ uid: 'other', amount: 1000 }]);
    assert.equal(c.call('jarStats', 'J', '2026-10').bal, -1000);
    // 我的裝置寫入 cover_me_2026-10 = 1,000，從日常扣
    const want = c.call('desiredMirrors', 'J');
    assert.equal(want['cover_me_2026-10'].amount, 1000);
    assert.equal(want['cover_me_2026-10'].srcId, 'day');
    // 日常少 1,000（撥款 1,000 + 份額 1,000）
    const d = c.stats('2026-10').day;
    assert.deepEqual(d.jarParts, [{ id: 'sj:J', contrib: 1000, cover: 1000, amount: 2000 }]);
    assert.equal(d.bal, 24000 - 2000);
    assertInvariant(c, '2026-10');
  });

  test('下個月情況 A：撥款 2,000、支出 1,500 → B = −500 → 新超支 0，沒有人需要墊付', () => {
    setup([
      jt('J', 'contrib', 1000, '2026-11-01', 'me', { srcId: 'day' }),
      jt('J', 'contrib', 1000, '2026-11-01', 'other'),
      jt('J', 'expense', 1500, '2026-11-08', 'me'),
    ]);
    const o = c.call('jarOver', 'J', '2026-11');
    assert.equal(o.over, 0);
    assert.equal(o.share, 0);
    assert.deepEqual(o.unpaid, []);
    assert.equal(c.call('jarStats', 'J', '2026-11').bal, -500);       // 之前未墊付的缺口不會再拿出來平分
    assert.equal(c.call('desiredMirrors', 'J')['cover_me_2026-11'], undefined);
  });

  test('下個月情況 B：撥款 2,000、支出 4,000 → B = −3,000 → 新超支 2,000，每人 1,000', () => {
    setup([
      jt('J', 'contrib', 1000, '2026-11-01', 'me', { srcId: 'day' }),
      jt('J', 'contrib', 1000, '2026-11-01', 'other'),
      jt('J', 'expense', 4000, '2026-11-08', 'other'),
    ]);
    const o = c.call('jarOver', 'J', '2026-11');
    assert.equal(o.over, 2000);
    assert.equal(o.share, 1000);
    assert.deepEqual(o.unpaid, [{ uid: 'me', amount: 1000 }, { uid: 'other', amount: 1000 }]);
    assert.equal(c.call('desiredMirrors', 'J')['cover_me_2026-11'].amount, 1000);
  });

  test('份額四捨五入：3 位成員、新超支 1,000 → 每人 333', () => {
    c.setState(ledger({ buckets: buckets(), excessTo: 'sav', sweepTo: 'sav' }), {
      user: { uid: 'me' }, jars: { J: jar(['me', 'a', 'b']) },
      jarTxns: { J: [jt('J', 'expense', 1000, '2026-11-08', 'a')] },
    });
    const o = c.call('jarOver', 'J', '2026-11');
    assert.equal(o.over, 1000);
    assert.equal(o.n, 3);
    assert.equal(o.share, 333);
  });
});
