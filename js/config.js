// 版本號與這次的更新內容。改版時只需要改這個檔案的 APP_VERSION 和 RELEASE。
// ===== App version: change only this line when releasing (sw.js picks it up automatically) =====
const APP_VERSION='v27';
// ===== What's new in this version (shown under the bell). Replace with the new release's notes each time. =====
// t: 'new' 新功能 / 'imp' 改善 / 'fix' 修正
const RELEASE={date:'2026-11-06',items:[
  {t:'imp',s:'每月歸零的罐子超支時，會在當月直接由指定罐子墊付，指定罐子的金額隨時反映真正存下來的錢。'},
  {t:'new',s:'超支的罐子會以紅框標示「超支 $X」，指定罐子標示「已墊付」；明細最上方新增「本月超支墊付」，可以展開查看。'},
  {t:'imp',s:'記帳時如果會超支，提示會先告訴你超出的金額由哪個罐子墊付。'}
]};
