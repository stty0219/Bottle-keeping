// 建立測試用帳本的小工具。所有資料都是虛構的，不要放入真實的記帳內容。
'use strict';

let seq = 0;
const nid = p => `${p}${++seq}`;

// 個人罐子
const spend = (id, name, amt, o = {}) => ({ id, name, amt, kind: 'spend', carry: false, coverBy: null, color: '#1F7A80', ...o });
const keep = (id, name, amt, o = {}) => spend(id, name, amt, { carry: true, ...o });     // 花費型、留到下個月
const save = (id, name, amt, o = {}) => ({ id, name, amt, kind: 'save', carry: true, coverBy: null, color: '#5C8A3A', ...o });

// 個人紀錄
const inc = (date, amount) => ({ id: nid('i'), ts: 0, type: 'income', mode: 'pct', amount, date, note: '' });
const incTo = (date, amount, target) => ({ id: nid('i'), ts: 0, type: 'income', mode: 'one', target, amount, date, note: '' });
const exp = (date, amount, bucketId) => ({ id: nid('e'), ts: 0, type: 'expense', catId: null, bucketId, amount, date, note: '' });
const xfer = (date, amount, from, to) => ({ id: nid('x'), ts: 0, type: 'transfer', from, to, amount, date, note: '' });

function ledger({ buckets, txns = [], excessTo, sweepTo, jarPlan = {}, ...rest }) {
  return {
    v: 1, allocMode: 'amount', buckets, categories: [], txns,
    excessTo: excessTo || null, sweepTo: sweepTo || null, jarPlan,
    kindV43: true, kindNote: false, jarOwnerV36: true, myColors: [], gradeRules: null, ...rest,
  };
}

// 共用罐：自己的撥款設定（jarPlan）
const plan = (from, hist, o = {}) => ({ from, name: '美樂蒂', hist, ...o });
// 共用罐裡的紀錄（Cloud.jarTxns）
const jt = (jid, kind, amount, date, by, o = {}) => ({ id: nid('j'), jid, kind, amount, date, by, byName: by, note: '', ...o });
const jar = (members, o = {}) => ({ name: '美樂蒂', color: '#D35D7A', owner: members[0], members, memberInfo: {}, categories: [], ...o });

module.exports = { spend, keep, save, inc, incTo, exp, xfer, ledger, plan, jt, jar };
