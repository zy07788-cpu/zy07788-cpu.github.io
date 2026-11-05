import {draftProject,readLegacyDrafts} from './legacy-drafts.mjs';

export function handoffURL(target,editor,query=''){
  const allowed=['article','poster','cover','moments'],requested=new URLSearchParams(query).get('editor');
  const chosen=allowed.includes(editor)?editor:allowed.includes(requested)?requested:null;
  const url=new URL(target);url.search='';url.hash='';if(chosen)url.searchParams.set('editor',chosen);return url.href;
}

export function initHandoff({document=globalThis.document,location=globalThis.location,URLAPI=globalThis.URL,BlobAPI=globalThis.Blob,readDrafts=readLegacyDrafts}={}){
  const body=document.body;
  for(const link of document.querySelectorAll('[data-studio-link]'))link.href=handoffURL(body.dataset.studioTarget,body.dataset.editor,location.search);
  const button=document.getElementById('find-drafts'),status=document.getElementById('recovery-status'),list=document.getElementById('draft-list');
  const urls=[];let busy=false;
  const notice=(message,error=false)=>{status.textContent=message;status.dataset.error=String(error);};
  button.disabled=false;
  button.addEventListener('click',async()=>{
    if(busy)return;busy=true;button.disabled=true;notice('正在查找这个网站在本浏览器留下的封面暂存…');
    for(const url of urls.splice(0))URLAPI.revokeObjectURL(url);list.replaceChildren();
    try{
      const drafts=await readDrafts();let failures=0;
      for(const draft of drafts){
        try{
          const {project,text}=draftProject(draft.record,draft.editor),item=document.createElement('li'),copy=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('small'),link=document.createElement('a');
          const name=project.elements.find(element=>element.id==='title'&&element.type==='text')?.text?.replace(/\s+/g,' ').slice(0,60)||'未命名封面';
          title.textContent=`${draft.label} · ${name}`;
          const time=draft.record.savedAt;detail.textContent=Number.isFinite(time)?'上次暂存：'+new Date(time).toLocaleString('zh-CN'):'保留原文字、图片与排版';
          const url=URLAPI.createObjectURL(new BlobAPI([text],{type:'application/json;charset=utf-8'}));urls.push(url);link.href=url;link.download=`${draft.editor}-我的定制.json`;link.textContent='下载我的定制 JSON';
          copy.append(title,detail);item.append(copy,link);list.append(item);
        }catch{failures++;}
      }
      const found=list.children.length;
      notice(found?`找到${found}份暂存。先下载 JSON，再到寻璞载入；请确认下载文件已保留。${failures?'另有暂存暂时无法识别，原数据未改动。':''}`:failures?'暂存结构暂时无法识别，原数据未改动。请保留原浏览器数据并联系维护者。':'这里没有找到旧封面暂存。请确认正在使用原来的网站地址和浏览器，或载入以前下载的定制 JSON。',!found&&Boolean(failures));
    }catch(error){notice(error.message||'暂存读取失败，原数据未改动。',true);}
    finally{busy=false;button.disabled=false;}
  });
  globalThis.addEventListener?.('pagehide',()=>{for(const url of urls.splice(0))URLAPI.revokeObjectURL(url);});
}

if(typeof document!=='undefined')initHandoff();
