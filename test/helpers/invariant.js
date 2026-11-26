// 不變量：所有個人罐子的餘額加總 = 實際的收入 − 支出 − 撥給共用罐的錢（每月撥款 + 自己的超支份額）。
// 這裡不使用 calc.js 的函式，而是直接從紀錄與撥款設定計算，作為獨立的對照。
'use strict';
const assert = require('node:assert/strict');

const mOf = d => d.slice(0, 7);
function nextMonth(mk) {
  let [y, m] = mk.split('-').map(Number);
  m++; if (m > 12) { m = 1; y++; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

// 截至 month（含）實際剩下的錢
function expectedTotal(c, month) {
  const S = c.state();
  const ids = new Set(S.buckets.map(b => b.id));
  let total = 0;
  for (const t of S.txns) {
    if (mOf(t.date) > month) continue;
    if (t.type === 'income') total += t.amount;
    else if (t.type === 'expense') total -= t.amount;
    // 個人罐子之間的轉移不改變總額
  }
  // 每月撥款：撥款期間內、不超過可切換的最遠月份（當月或有紀錄的最遠月份）、所屬罐子還在
  const horizon = S.txns.reduce((a, t) => (mOf(t.date) > a ? mOf(t.date) : a), c.CUR);
  for (const jid in S.jarPlan || {}) {
    const jp = S.jarPlan[jid];
    for (let mk = jp.from || month; mk <= month; mk = nextMonth(mk)) {
      if ((jp.from && mk < jp.from) || (jp.until && mk >= jp.until) || mk > horizon) continue;
      let e = null; for (const x of jp.hist || []) if (x.m <= mk) e = x;
      if (e && +e.amt > 0 && ids.has(e.src)) total -= +e.amt;
    }
  }
  // 自己寫入共用罐的超支份額
  const me = c.run('myUid()');
  const jarTxns = c.plain(c.run('Cloud.jarTxns'));
  if (me) for (const jid in jarTxns) for (const t of jarTxns[jid]) {
    if (t.kind === 'cover' && t.by === me && ids.has(t.srcId) && mOf(t.date) <= month) total -= t.amount;
  }
  return total;
}

function assertInvariant(c, month, label = '') {
  const st = c.stats(month);
  const sum = Object.values(st).reduce((a, s) => a + s.bal, 0);
  assert.equal(sum, expectedTotal(c, month), `所有個人罐子的合計應等於實際剩下的錢 ${label} ${month}`);
}

module.exports = { assertInvariant, expectedTotal, nextMonth };
