// 版本號與這次的更新內容。改版時只需要改這個檔案的 APP_VERSION 和 RELEASE。
// ===== App version: change only this line when releasing (sw.js picks it up automatically) =====
const APP_VERSION='v25';
// ===== What's new in this version (shown under the bell). Replace with the new release's notes each time. =====
// t: 'new' 新功能 / 'imp' 改善 / 'fix' 修正
const RELEASE={date:'2026-11-03',items:[
  {t:'imp',s:'程式內部重新整理，拆分成多個檔案，畫面和功能都沒有改變。'},
  {t:'imp',s:'更新時會確認每個檔案都是最新版本，降低更新後畫面異常的機會。'}
]};
