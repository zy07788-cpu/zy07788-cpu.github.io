const DATABASE='xunpu-cover-editor',STORE='drafts';
const SOURCES=Object.freeze([
  {key:'/tools/cover/index.html',editor:'cover',label:'公众号封面'},
  {key:'/tools/cover/',editor:'cover',label:'公众号封面（目录入口）'},
  {key:'/tools/poster/index.html',editor:'poster',label:'图文封面'},
  {key:'/tools/poster/',editor:'poster',label:'图文封面（目录入口）'},
]);
export const MAX_DRAFT_BYTES=60*1024*1024;

// A saved draft is {state,mode,savedAt}; downloaded legacy files contain state only.
export function draftProject(record,editor){
  const state=record?.state;
  if(!record||typeof record!=='object'||Array.isArray(record)||!state||typeof state!=='object'||Array.isArray(state)
      ||![2,3].includes(state.schemaVersion)||!Array.isArray(state.elements)||state.elements.length>50
      ||typeof state.art!=='string'||!state.background||typeof state.background!=='object'
      ||!['cover','poster'].includes(editor)
      ||(state.documentType||(state.schemaVersion===2?'cover':null))!==editor
      ||!['wide','square'].includes(record.mode))throw Error('这份暂存结构无法识别，未改动原数据。');
  const project={...state,activeMode:record.mode};
  let text;try{text=JSON.stringify(project,null,2);}catch{throw Error('这份暂存无法生成 JSON，未改动原数据。');}
  if(new TextEncoder().encode(text).length>MAX_DRAFT_BYTES)throw Error('这份暂存超过60MB，未改动原数据。');
  // No normalization or schema upgrade here: the destination editor validates on import.
  return {project:JSON.parse(text),text};
}

function openExisting(factory,timeout){
  return new Promise((resolve,reject)=>{
    let settled=false,request;
    const finish=(error,value)=>{if(settled){value?.close();return;}settled=true;clearTimeout(timer);error?reject(error):resolve(value);};
    const timer=setTimeout(()=>finish(Error('读取本机暂存超时，请关闭其他旧编辑页面后重试。')),timeout);
    try{request=factory.open(DATABASE);}catch{finish(Error('当前浏览器无法读取本机暂存。'));return;}
    // Opening a missing database would create it. Abort that upgrade instead of writing.
    request.onupgradeneeded=()=>{try{request.transaction.abort();}catch{}finish(null,null);};
    request.onsuccess=()=>finish(null,request.result);
    request.onerror=()=>{if(!settled)finish(Error('读取本机暂存失败，原数据未改动。'));};
    request.onblocked=()=>finish(Error('本机暂存正被旧页面占用，请关闭旧页面后重试。'));
  });
}

function readRecords(database,timeout){
  return new Promise((resolve,reject)=>{
    let transaction,settled=false;const found=[];
    const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(found);};
    const timer=setTimeout(()=>{finish(Error('读取本机暂存超时，原数据未改动。'));try{transaction?.abort();}catch{}},timeout);
    try{
      transaction=database.transaction(STORE,'readonly');const store=transaction.objectStore(STORE);
      for(const source of SOURCES){
        const request=store.get(source.key);
        request.onsuccess=()=>{if(request.result!==undefined)found.push({...source,record:request.result});};
      }
      transaction.oncomplete=()=>finish();
      transaction.onerror=()=>finish(Error('读取本机暂存失败，原数据未改动。'));
      transaction.onabort=()=>finish(Error('读取本机暂存中断，原数据未改动。'));
    }catch{finish(Error('无法读取旧封面暂存，原数据未改动。'));}
  });
}

export async function readLegacyDrafts(factory=globalThis.indexedDB,{timeout=3500}={}){
  if(!factory?.open)throw Error('当前浏览器不支持本机暂存读取，请使用原来编辑时的浏览器。');
  let database;
  try{
    database=await openExisting(factory,timeout);
    if(!database||!database.objectStoreNames.contains(STORE))return [];
    return await readRecords(database,timeout);
  }finally{database?.close();}
}
