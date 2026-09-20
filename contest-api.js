'use strict';
// GitHub Pages demo backend: each visitor gets an independent IndexedDB database.
(() => {
  const nativeFetch=window.fetch.bind(window),databaseName='knowledge-base-contest-v1';
  const fixed=[['fixed-reading','读书笔记'],['fixed-ideas','灵感碎片'],['fixed-learning','学习笔记'],['fixed-life','生活感悟']];
  const now=()=>new Date().toISOString();
  const copy=value=>JSON.parse(JSON.stringify(value));
  function seed(){
    const categories=fixed.map(([id,name],position)=>({id,name,parentId:null,depth:1,locked:true,position}));
    const names=[['demo-post','后期',null,1],['demo-material','后期资料','demo-post',2],['demo-ai','AI','demo-material',3],['demo-houdini','Houdini','demo-material',3],['demo-ae','AE','demo-material',3],['demo-edit','剪辑','demo-material',3]];
    for(const [id,name,parentId,depth] of names)categories.push({id,name,parentId,depth,locked:false,position:categories.length});
    const day=new Date().toISOString();
    const records=[
      {id:'sample-welcome',title:'欢迎体验我的知识库',summary:'创建、分类、搜索与备份，都可以在这里试一试。',content:'<h2>这是独立的参赛体验版</h2><p>点击左侧类目筛选内容，或新建一条自己的记录。你的修改只保存在当前浏览器，不会被其他访客看到。</p><p>右键点击“后期”可新建二级目录；右键点击“后期资料”可新建三级目录。</p>',tags:['使用指南'],categoryId:'fixed-learning',cover:null,favorite:true,createdAt:day,updatedAt:day,version:1,deletedAt:null},
      {id:'sample-ai',title:'AI 后期工作流',summary:'从素材整理到画面处理的示例知识。',content:'<h2>AI 素材整理</h2><p>先记录素材来源和授权，再整理镜头目标、提示词与输出版本。</p><ul><li>将可复用的方法归档到三级类目</li><li>通过自由标签关联跨领域内容</li></ul>',tags:['AI','后期'],categoryId:'demo-ai',cover:null,favorite:false,createdAt:day,updatedAt:day,version:1,deletedAt:null},
      {id:'sample-edit',title:'剪辑交付清单',summary:'一个可以继续编辑的示例记录。',content:'<p>检查节奏、字幕、音频电平与最终导出格式。</p>',tags:['剪辑'],categoryId:'demo-edit',cover:null,favorite:false,createdAt:day,updatedAt:day,version:1,deletedAt:null}
    ];
    return {records,categories,operations:{},history:{},vaultId:'contest-public-demo-v1'};
  }
  const opening=new Promise((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onupgradeneeded=()=>request.result.createObjectStore('data');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  async function withData(work){const database=await opening;return new Promise((resolve,reject)=>{const tx=database.transaction('data','readwrite'),store=tx.objectStore('data'),request=store.get('main');let result;request.onsuccess=()=>{try{const data=request.result||seed();result=work(data);store.put(data,'main');}catch(error){reject(error);tx.abort();}};request.onerror=()=>reject(request.error);tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);});}
  function error(message,status=400){const issue=new Error(message);issue.status=status;throw issue;}
  function nodePath(id,nodes){const byId=new Map(nodes.map(node=>[node.id,node]));const result=[];let node=byId.get(id);while(node){result.unshift(node);node=byId.get(node.parentId);}return result;}
  function descendants(id,nodes){const ids=[id];for(let i=0;i<ids.length;i++)for(const node of nodes)if(node.parentId===ids[i])ids.push(node.id);return ids;}
  function stats(data){const active=data.records.filter(r=>!r.deletedAt),tags={},categoryCounts={};for(const node of data.categories){tags[node.name]=0;categoryCounts[node.id]=0;}
    for(const record of active){for(const tag of record.tags||[])tags[tag]=(tags[tag]||0)+1;if(record.categoryId)for(const node of nodePath(record.categoryId,data.categories))categoryCounts[node.id]++;}
    const week=new Date();week.setDate(week.getDate()-7);
    return {count:active.length,favorites:active.filter(r=>r.favorite).length,week:active.filter(r=>new Date(r.createdAt)>=week).length,trash:data.records.length-active.length,tags,categories:copy(data.categories),categoryCounts,bytes:JSON.stringify(data.records).length*2,lastBackup:null,dataDir:'当前浏览器（参赛体验版）',backupDir:'浏览器下载',vaultId:data.vaultId};
  }
  function query(data,params){const view=params.get('view')||'all',q=(params.get('q')||'').toLocaleLowerCase(),category=params.get('category'),tag=params.get('tag'),tags=params.getAll('tags').filter(Boolean),from=params.get('from'),to=params.get('to'),media=params.get('media'),sort=params.get('sort'),limit=Math.min(100,Math.max(1,Number(params.get('limit'))||24)),page=Math.max(1,Number(params.get('page'))||1);
    let records=data.records.filter(r=>view==='trash'?!!r.deletedAt:!r.deletedAt);
    if(view==='favorites')records=records.filter(r=>r.favorite);
    if(q)records=records.filter(r=>(r.title+' '+r.summary+' '+r.content).toLocaleLowerCase().includes(q));
    for(const selected of [tag,...tags].filter(Boolean))records=records.filter(r=>r.tags.includes(selected));
    if(category){const ids=descendants(category,data.categories);records=records.filter(r=>ids.includes(r.categoryId));}
    if(params.get('untagged')==='1')records=records.filter(r=>!r.tags.length);
    if(from)records=records.filter(r=>r.updatedAt.slice(0,10)>=from);
    if(to)records=records.filter(r=>r.updatedAt.slice(0,10)<=to);
    if(media==='image')records=records.filter(r=>/<img\b/i.test(r.content));
    if(media==='video')records=records.filter(r=>/<video\b/i.test(r.content));
    if(media==='none')records=records.filter(r=>!/<(?:img|video)\b/i.test(r.content));
    records.sort((a,b)=>sort==='title-asc'?a.title.localeCompare(b.title,'zh-CN'):sort==='updated-asc'?a.updatedAt.localeCompare(b.updatedAt):sort==='created-desc'?b.createdAt.localeCompare(a.createdAt):b.updatedAt.localeCompare(a.updatedAt));
    return {total:records.length,page,limit,items:records.slice((page-1)*limit,page*limit).map(({content,...record})=>({...copy(record),matchExcerpt:q?content.replace(/<[^>]*>/g,' ').slice(0,200):null}))};
  }
  function createCategory(data,body){const name=typeof body.name==='string'?body.name.trim():'',parentId=body.parentId||null,parent=data.categories.find(node=>node.id===parentId);
    if(!name||name.length>60||/[,，\r\n\t]/.test(name))error('类目名称须为 1—60 字，且不能包含逗号或换行');
    if(parentId&&!parent)error('上级类目不存在',404);
    if(parent&&parent.depth>=3)error('类目最多三级');
    if(data.categories.some(node=>node.parentId===parentId&&node.name.toLocaleLowerCase()===name.toLocaleLowerCase()))error('同一级已有这个类目',409);
    if(data.categories.length>=204)error('最多保留 200 个自建类目');
    const node={id:crypto.randomUUID(),name,parentId,depth:parent?parent.depth+1:1,locked:false,position:data.categories.length};data.categories.push(node);return {...copy(node),categories:copy(data.categories)};
  }
  function operation(data,body){const {opId,action,id,baseVersion}=body;if(typeof opId!=='string')error('操作编号无效');if(data.operations[opId])return copy(data.operations[opId]);
    const index=data.records.findIndex(r=>r.id===id),old=data.records[index];let record;
    if(action==='create'){if(old)error('记录已存在',409);record={...body.record,id,title:body.record.title||'无标题',tags:body.record.tags||[],categoryId:body.record.categoryId||null,version:1,createdAt:body.record.createdAt||now(),updatedAt:now(),deletedAt:null,favorite:!!body.record.favorite};if(record.categoryId&&!data.categories.some(node=>node.id===record.categoryId))error('所属类目不存在');data.records.unshift(record);}
    else{if(!old)error('记录不存在',404);if(Number(baseVersion)!==old.version)error('记录已被其他窗口修改',409);
      const history=data.history[id]||(data.history[id]=[]);history.unshift({version:old.version,savedAt:now(),snapshot:copy(old)});history.length=Math.min(20,history.length);
      if(action==='update'){record={...old,...body.record,id,createdAt:old.createdAt,version:old.version+1,updatedAt:now()};if(record.categoryId&&!data.categories.some(node=>node.id===record.categoryId))error('所属类目不存在');}
      else if(action==='delete'||action==='restore')record={...old,deletedAt:action==='delete'?now():null,updatedAt:now(),version:old.version+1};
      else if(action==='restore-version'){const previous=history.find(h=>h.version===Number(body.targetVersion));if(!previous)error('历史版本不存在',404);record={...copy(previous.snapshot),id,createdAt:old.createdAt,updatedAt:now(),version:old.version+1,deletedAt:null};}
      else error('不支持的操作');data.records[index]=record;
    }
    data.operations[opId]=copy(record);return copy(record);
  }
  function backup(data){return {format:'knowledge-base',version:2,exportedAt:now(),records:copy(data.records),categories:copy(data.categories),attachments:{}};}
  function importBackup(data,body,preview){const incoming=body.backup;if(!incoming||!Array.isArray(incoming.records)||!Array.isArray(incoming.categories))error('备份格式无效');
    const conflicts=incoming.records.filter(r=>data.records.some(current=>current.id===r.id)).length;
    if(preview)return {total:incoming.records.length,added:incoming.records.length-conflicts,conflicts,attachments:Object.keys(incoming.attachments||{}).length,categories:incoming.categories.filter(node=>!node.locked).length,verified:false};
    const mapping=new Map();for(const node of incoming.categories){if(data.categories.some(current=>current.id===node.id)){mapping.set(node.id,node.id);continue;}const parentId=mapping.get(node.parentId)||node.parentId||null;const same=data.categories.find(current=>current.parentId===parentId&&current.name===node.name);if(same){mapping.set(node.id,same.id);continue;}if(parentId&&!data.categories.some(current=>current.id===parentId))error('备份类目缺少上级');data.categories.push({...node,parentId,position:data.categories.length});mapping.set(node.id,node.id);}
    let added=0,skipped=0,updated=0;for(const item of incoming.records){const record=copy(item),index=data.records.findIndex(current=>current.id===record.id);if(index>=0&&body.mode!=='overwrite'){skipped++;continue;}record.categoryId=mapping.get(record.categoryId)||record.categoryId||null;if(index>=0){record.version=data.records[index].version+1;data.records[index]=record;updated++;}else{data.records.push(record);added++;}}return {added,skipped,updated,categories:data.categories.length-4};
  }
  async function handle(url,options){const method=(options.method||'GET').toUpperCase(),pathname=url.pathname,body=options.body&&typeof options.body==='string'?JSON.parse(options.body):{};
    if(pathname==='/api/attachments'&&method==='POST'){
      const blob=options.body;if(!blob||blob.size>8*1024*1024)error('体验版单个附件最多 8MB');
      const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
      return {url:`data:${blob.type==='application/octet-stream'?'image/png':blob.type};base64,${btoa(binary)}`,bytes:bytes.length};
    }
    return withData(data=>{
      if(pathname==='/api/health')return {status:'ok',version:'2.3.3',pid:0,dataDir:'当前浏览器',vaultId:data.vaultId,lan:false};
      if(pathname==='/api/stats')return stats(data);
      if(pathname==='/api/records')return query(data,url.searchParams);
      if(pathname==='/api/categories')return method==='POST'?createCategory(data,body):copy(data.categories);
      if(pathname==='/api/operations')return operation(data,body);
      if(pathname==='/api/backup')return backup(data);
      if(pathname==='/api/import/preview')return importBackup(data,body,true);
      if(pathname==='/api/import')return importBackup(data,body,false);
      if(pathname==='/api/login')return {ok:true};
      if(pathname==='/api/storage/locations')return {dataDir:'当前浏览器',backupDir:'浏览器下载'};
      if(pathname.startsWith('/api/storage/')||pathname==='/api/backup/save')error('网页版数据保存在当前浏览器，请使用“选择位置并保存完整备份”。');
      const parts=pathname.split('/').filter(Boolean);
      if(parts[0]==='api'&&parts[1]==='records'&&parts[2]){
        const record=data.records.find(item=>item.id===decodeURIComponent(parts[2]));if(!record)error('记录不存在',404);
        if(parts[3]==='history'&&parts[4]){const entry=(data.history[record.id]||[]).find(h=>h.version===Number(parts[4]));if(!entry)error('历史版本不存在',404);return copy(entry.snapshot);}
        if(parts[3]==='history')return (data.history[record.id]||[]).map(({version,savedAt})=>({version,savedAt}));
        return copy(record);
      }
      error('资源不存在',404);
    });
  }
  window.fetch=async(input,options={})=>{const url=new URL(typeof input==='string'?input:input.url,location.href);
    if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))return nativeFetch(input,options);
    try{return new Response(JSON.stringify(await handle(url,options)),{status:200,headers:{'Content-Type':'application/json'}});}
    catch(issue){return new Response(JSON.stringify({error:issue.message||'保存失败'}),{status:issue.status||500,headers:{'Content-Type':'application/json'}});}
  };
})();
