// 版本號與這次的更新內容。改版時只需要改這個檔案的 APP_VERSION 和 RELEASE。
// ===== App version: change only this line when releasing (sw.js picks it up automatically) =====
const APP_VERSION='v32';
// ===== What's new in this version (shown under the bell). Replace with the new release's notes each time. =====
// t: 'new' 新功能 / 'imp' 改善 / 'fix' 修正
const RELEASE={date:'2026-11-13',items:[
  {t:'new',s:'每個罐子都可以設定超支時由哪個罐子墊付，例如日常超支從儲蓄扣。'},
  {t:'imp',s:'取消「指定罐子」，改為分別設定「收入超過計畫的錢」和「歸零罐子月底的剩餘或不足」要放入哪個罐子。'},
  {t:'imp',s:'明細會顯示哪個罐子替誰墊付了多少。'}
]};
