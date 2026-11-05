// version comes from js/config.js (index.html registers 'sw.js?v=…'), so there's nothing to edit here
const CACHE='fenguan-'+(new URL(self.location).searchParams.get('v')||'dev');
// files the app needs to start offline — keep in sync when adding/removing a file in css/ or js/
const CORE=[
  './',
  './index.html',
  './firebase-config.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './css/base.css',
  './css/dev.css',
  './css/home.css',
  './css/list.css',
  './css/notify.css',
  './css/settings.css',
  './css/sheet.css',
  './css/summary.css',
  './css/themes.css',
  './js/config.js',
  './js/state.js',
  './js/cloud.js',
  './js/shared-jars.js',
  './js/account.js',
  './js/setup.js',
  './js/notify.js',
  './js/init.js',
  './js/calc.js',
  './js/views/home.js',
  './js/views/list.js',
  './js/views/settings.js',
  './js/summary.js',
  './js/dev.js',
  './js/sheet.js',
  './js/entry.js',
  './js/ui.js',
  './js/reorder.js',
  './js/main.js'
];
// 只快取 App 本身、字型和 Firebase SDK；Firebase 的登入與資料連線一律直接走網路
const CACHE_HOSTS=['www.gstatic.com','fonts.googleapis.com','fonts.gstatic.com'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url),same=u.origin===self.location.origin;
  if(!same&&!CACHE_HOSTS.includes(u.hostname))return;
  // own files: always revalidate with the server, so index.html, css/ and js/ never mix versions
  const req=same?new Request(u.href,{cache:'no-cache',credentials:'same-origin'}):e.request;
  e.respondWith(
    fetch(req).then(res=>{if(res.ok||res.type==='opaque'){const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{})}return res})
    .catch(()=>caches.match(e.request,{ignoreSearch:same}).then(r=>r||(e.request.mode==='navigate'?caches.match('./index.html'):undefined)))
  );
});
