// 版本號與這次的更新內容。改版時只需要改這個檔案的 APP_VERSION 和 RELEASE。
// ===== App version: change only this line when releasing (sw.js picks it up automatically) =====
const APP_VERSION='v29';
// ===== What's new in this version (shown under the bell). Replace with the new release's notes each time. =====
// t: 'new' 新功能 / 'imp' 改善 / 'fix' 修正
const RELEASE={date:'2026-11-09',items:[
  {t:'fix',s:'修正用「自訂…」選顏色時，還在調整就被套用成別的顏色的問題。現在選好後按「使用這個顏色」才會套用。'},
  {t:'new',s:'「最近使用」改為「我的顏色」：自訂顏色可以按「加入我的顏色」收藏，按「編輯」可以刪除或按住拖拉調整順序。'},
  {t:'new',s:'「我的顏色」會跟著帳本同步，換手機或在其他裝置登入也看得到。'}
]};
