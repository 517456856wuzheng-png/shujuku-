'use strict';
const CACHE='knowledge-base-contest-v2';
const FILES=['./','./index.html','./contest-api.js','./storage.js','./app.js','./styles.css','./desktop.css','./app-icon.svg','./app-icon.ico'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.origin!==self.location.origin||url.pathname.includes('/api/'))return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));});
