// 共用小工具、預設資料、全域狀態與本機儲存
const PALETTE=['#1F7A80','#D29A17','#8A4F7D','#3D6FB6','#5C8A3A','#C25B3A','#6B6F7A'];
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>(n<0?'−':'')+'$'+Math.abs(Math.round(n)).toLocaleString('zh-TW');

function defaults(){
  const inv={id:'b_inv',name:'投資',pct:30,color:PALETTE[0]},day={id:'b_day',name:'日常',pct:50,color:PALETTE[1]},flex={id:'b_flex',name:'彈性',pct:20,color:PALETTE[2]};
  const c=(e,n,b)=>({id:uid(),emoji:e,name:n,bucketId:b.id});
  return {v:1,allocMode:'amount',remainderId:flex.id,buckets:[inv,day,flex],categories:[
    c('🍱','餐飲',day),c('🚌','交通',day),c('🛒','日用品',day),c('🏠','居住',day),c('📱','電信',day),
    c('📈','股票/ETF',inv),c('🏦','儲蓄',inv),
    c('🎬','娛樂',flex),c('✈️','旅遊',flex),c('🛍️','購物',flex),c('🎁','禮物',flex)
  ],txns:[],myColors:[]};
}

let S=null;               // state
let tab='home';
let listMonth=today().slice(0,7), listBucket='all', listCat=null, listQuery='', listAllMonths=false;
let draft=null;
const LSK='fenguan-ledger-v1';

/* ---------- local storage ---------- */
function loadLocal(){try{const r=localStorage.getItem(LSK);return r?JSON.parse(r):null}catch(e){return null}}
function saveLocal(){planCache=null;horizonCache=null;try{localStorage.setItem(LSK,JSON.stringify(S))}catch(e){}}
function setSync(t){document.getElementById('sync').textContent=t}
const clean=o=>JSON.parse(JSON.stringify(o));
