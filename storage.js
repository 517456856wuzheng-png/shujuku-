/* Durable browser storage. Records, drafts and pending operations use separate stores. */
'use strict';
window.VaultStore = (() => {
 let database;
 async function open(name) { database=await new Promise((resolve,reject)=>{const request=indexedDB.open('knowledge-base-v2-'+name,1);request.onupgradeneeded=()=>{for(const key of ['records','queue','drafts','meta'])request.result.createObjectStore(key,{keyPath:'id'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);}); }
 function run(store,mode,work){return new Promise((resolve,reject)=>{const tx=database.transaction(store,mode);let value;const request=work(tx.objectStore(store));if(request)request.onsuccess=()=>{value=request.result;};tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('本地保存被中断'));});}
 const get=(store,id)=>run(store,'readonly',s=>s.get(id));
 const all=store=>run(store,'readonly',s=>s.getAll());
 const put=(store,value)=>run(store,'readwrite',s=>s.put(value));
 const remove=(store,id)=>run(store,'readwrite',s=>s.delete(id));
 async function enqueue(op,r){return new Promise((resolve,reject)=>{const tx=database.transaction(['queue','records'],'readwrite');tx.objectStore('queue').put(op);tx.objectStore('records').put(r);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('本地存储不足'));});}
 return {open,get,all,put,remove,enqueue};
})();
