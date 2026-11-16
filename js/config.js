// 版本號與這次的更新內容。改版時只需要改這個檔案的 APP_VERSION 和 RELEASE。
// ===== App version: change only this line when releasing (sw.js picks it up automatically) =====
const APP_VERSION='v34';
// ===== What's new in this version (shown under the bell). Replace with the new release's notes each time. =====
// t: 'new' 新功能 / 'imp' 改善 / 'fix' 修正
const RELEASE={date:'2026-11-16',items:[
  {t:'imp',s:'設定頁的支出分類改為依罐子分組，可以展開、收合，組內可以拖拉排序。'},
  {t:'imp',s:'共用罐的共用分類也整理到支出分類中管理。'},
  {t:'imp',s:'個人分類不再能設定扣共用罐，共用支出統一使用共用分類；原本的設定會自動轉換成共用分類。'}
]};
