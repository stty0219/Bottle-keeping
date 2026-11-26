// 個人支出（#19）與月結算評等（calculation-rules.md 第 6、9 節）
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('../helpers/load-core');
const { assertInvariant } = require('../helpers/invariant');
const { spend, save, inc, exp, ledger, plan, jt, jar } = require('../helpers/ledger');

const c = loadCore();

describe('#19 個人支出 = 個人支出 + 撥給共用罐的錢', () => {
  // 你在日常記「午餐 300」；你和對方各撥款 1,000 到美樂蒂（屬於日常）；
  // 美樂蒂內對方記「家用 800」、你記「聚餐 1,500」，共 2,300，超出撥款 300，兩人各墊付 150
  const setup = () => c.setState(ledger({
    buckets: [spend('day', '日常', 24000, { coverBy: 'sav' }), save('sav', '儲蓄', 20000)], excessTo: 'sav', sweepTo: 'sav',
    jarPlan: { J: plan('2026-10', [{ m: '2026-10', amt: 1000, src: 'day', coverBy: 'day' }]) },
    txns: [inc('2026-10-01', 44000), exp('2026-10-12', 300, 'day')],
  }), {
    user: { uid: 'me' }, jars: { J: jar(['me', 'other']) },
    jarTxns: { J: [
      jt('J', 'contrib', 1000, '2026-10-01', 'me', { srcId: 'day' }),
      jt('J', 'contrib', 1000, '2026-10-01', 'other'),
      jt('J', 'expense', 800, '2026-10-05', 'other', { note: '家用' }),
      jt('J', 'expense', 1500, '2026-10-18', 'me', { note: '聚餐' }),
      jt('J', 'cover', 150, '2026-10-01', 'me', { srcId: 'day' }),
      jt('J', 'cover', 150, '2026-10-01', 'other'),
    ] },
  });

  test('美樂蒂超出撥款 300，兩人各 150，都已墊付', () => {
    setup();
    const o = c.call('jarOver', 'J', '2026-10');
    assert.equal(o.over, 300);
    assert.equal(o.share, 150);
    assert.deepEqual(o.unpaid, []);
  });

  test('你的支出 = 300 + 1,000 + 150 = 1,450（共用支出 2,300 不計入）', () => {
    setup();
    assert.equal(c.call('ownSpend', '2026-10'), 300);
    const sh = c.call('sharedSpend', '2026-10');
    assert.equal(sh.total, 1150);
    assert.deepEqual(sh.parts, [{ id: 'sj:J', contrib: 1000, cover: 150, amount: 1150 }]);
    const d = c.call('monthData', '2026-10');
    assert.equal(d.spend, 1450);
    assert.equal(d.inc, 44000);
    assert.equal(d.net, 44000 - 1450);
    assert.equal(c.stats('2026-10').day.bal, 24000 - 1450);
    assertInvariant(c, '2026-10');
  });
});

describe('評等門檻（預設 S 30%、A 10%、B 最多 1 個超支罐子）', () => {
  const g = (inc, spendAmt, over) => c.call('gradeOf', { inc, net: inc - spendAmt, over });
  test('收入 50,000', () => {
    c.setState(ledger({ buckets: [save('sav', '儲蓄', 0)] }));
    assert.equal(g(50000, 35000, 0), 'S');                            // 結餘率 30%，剛好達到 S
    assert.equal(g(50000, 35001, 0), 'A');
    assert.equal(g(50000, 45000, 0), 'A');                            // 結餘率 10%
    assert.equal(g(50000, 45001, 0), 'B');
    assert.equal(g(50000, 50001, 0), 'C');                            // 結餘 < 0
    assert.equal(g(50000, 10000, 1), 'B');                            // 有 1 個超支罐子，即使結餘率很高
    assert.equal(g(50000, 10000, 2), 'C');
    assert.equal(g(50000, 50001, 1), 'C');
  });
  test('沒有收入的月份：超支 0／1／2 個罐子 → A／B／C', () => {
    c.setState(ledger({ buckets: [save('sav', '儲蓄', 0)] }));
    assert.equal(g(0, 5000, 0), 'A');
    assert.equal(g(0, 5000, 1), 'B');
    assert.equal(g(0, 5000, 2), 'C');
  });
  test('自訂門檻（S 50%）會生效', () => {
    c.setState(ledger({ buckets: [save('sav', '儲蓄', 0)], gradeRules: { sRate: 0.5, aRate: 0.1, bMaxOver: 0 } }));
    assert.equal(g(50000, 35000, 0), 'A');
    assert.equal(g(50000, 25000, 0), 'S');
    assert.equal(g(50000, 10000, 1), 'C');                            // bMaxOver 0
  });
});

describe('月結算的超支罐子數', () => {
  test('被墊付的罐子仍算超支：日常花 26,000（由儲蓄墊付）→ 超支 1 個、評等 B', () => {
    c.setState(ledger({
      buckets: [spend('day', '日常', 24000, { coverBy: 'sav' }), save('sav', '儲蓄', 20000)], excessTo: 'sav', sweepTo: 'sav',
      txns: [inc('2026-10-01', 44000), exp('2026-10-10', 26000, 'day')],
    }));
    const d = c.call('monthData', '2026-10');
    assert.equal(d.over, 1);
    assert.equal(d.net, 18000);
    assert.equal(c.call('gradeOf', d), 'B');
  });

  test('只因替其他罐子墊付而變負數的罐子不算', () => {
    c.setState(ledger({
      buckets: [spend('day', '日常', 24000, { coverBy: 'flex' }), spend('flex', '彈性', 1000, { coverBy: 'sav' }), save('sav', '儲蓄', 20000)],
      excessTo: 'sav', sweepTo: 'sav',
      txns: [inc('2026-10-01', 45000), exp('2026-10-10', 27000, 'day')],
    }));
    const d = c.call('monthData', '2026-10');
    assert.equal(c.stats('2026-10').flex.bal, -2000);
    assert.equal(d.over, 1);                                           // 只有日常
  });

  test('撥給共用罐的錢造成的超支也算（#24 情況 A）', () => {
    c.setState(ledger({
      buckets: [spend('day', '日常', 24000, { coverBy: 'sav' }), save('sav', '儲蓄', 0)], excessTo: 'sav', sweepTo: 'sav',
      jarPlan: { J: plan('2026-10', [{ m: '2026-10', amt: 1000, src: 'day', coverBy: 'day' }]) },
      txns: [inc('2026-10-01', 24000), exp('2026-10-10', 23000, 'day')],
    }), { user: { uid: 'me' }, jars: { J: jar(['me', 'other']) }, jarTxns: { J: [jt('J', 'cover', 500, '2026-10-01', 'me', { srcId: 'day' })] } });
    const d = c.call('monthData', '2026-10');
    assert.equal(d.over, 1);
    assert.equal(d.spend, 23000 + 1000 + 500);
  });

  test('沒有收入、也沒有超支的月份 → A', () => {
    c.setState(ledger({
      buckets: [spend('day', '日常', 24000), save('sav', '儲蓄', 20000)], excessTo: 'sav', sweepTo: 'sav',
      txns: [inc('2026-09-01', 44000), exp('2026-10-10', 5000, 'sav')],
    }));
    const d = c.call('monthData', '2026-10');
    assert.equal(d.inc, 0);
    assert.equal(d.over, 0);
    assert.equal(c.call('gradeOf', d), 'A');
  });
});
