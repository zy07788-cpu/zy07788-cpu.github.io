import {wrapProject,readProject,projectTitle,MAX_PROJECT_BYTES} from './studio-project.mjs?v=e584159048f79e2b';
import {cleanFilename,downloadBlob,zipFiles} from './editors/moments/downloads.mjs?v=e584159048f79e2b';

const $=id=>document.getElementById(id);
const routes={article:'./articles/index.html',moments:'./editors/moments/index.html',poster:'../poster/index.html',cover:'../cover/index.html'};
const names={article:'图文阅读',moments:'动态卡',cover:'公众号封面',poster:'图文封面'};
const frames=new Map(),handles=new Map();
const version=new URL(import.meta.url).searchParams.get('v');
let active='article',coverKind='poster',busy=false,feedbackDirty=false;
const group=kind=>['cover','poster'].includes(kind)?'covers':kind;
const selected=new URLSearchParams(location.search).get('editor');
if(Object.hasOwn(routes,selected)){active=selected;if(group(active)==='covers')coverKind=active;}
document.body.classList.toggle('embedded',window.parent!==window);

function status(message,error=false){$('studio-status').textContent=message;$('studio-status').classList.toggle('error',error);reportHeight();}
function controls(){
  const ready=Boolean(frames.get(active)?.api);
  for(const id of ['studio-save','studio-export','studio-feedback'])$(id).disabled=busy||!ready;
  $('studio-load').disabled=busy;$('studio-feedback-download').disabled=busy;
  $('studio-feedback-notes').disabled=busy;
  for(const button of document.querySelectorAll('[data-group]')){button.disabled=busy;const isActive=button.dataset.group===group(active);button.setAttribute('aria-selected',String(isActive));button.tabIndex=isActive?0:-1;}
  $('cover-family').hidden=group(active)!=='covers';$('cover-kind').value=coverKind;$('cover-kind').disabled=busy;
  for(const [kind,entry]of frames)entry.panel.hidden=kind!==active;
  $('editor-host').setAttribute('aria-busy',String(busy||!ready));
}
async function waitReady(frame){
  const deadline=Date.now()+30000;
  while(Date.now()<deadline){
    const win=frame.contentWindow;
    if(win?.layoutEditor&&win.document.body?.dataset.editorReady==='true')return win.layoutEditor;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  throw Error('编辑器资源未能完整载入，请检查网络后刷新；已有工程文件仍可保留。');
}
async function ensureFrame(kind){
  if(frames.has(kind))return frames.get(kind).ready;
  const panel=document.createElement('section');panel.id=`editor-${kind}`;panel.className='editor-panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',`tab-${group(kind)}`);panel.hidden=kind!==active;
  const frame=document.createElement('iframe');frame.className='editor-frame';frame.title=`${names[kind]}编辑器`;frame.src=`${routes[kind]}?embedded=1${version?`&v=${version}`:''}`;
  panel.append(frame);const entry={panel,frame,api:null,ready:null};frames.set(kind,entry);$('editor-host').append(panel);
  entry.ready=waitReady(frame).then(api=>{if(api.kind!==kind)throw Error('编辑器类型与入口不一致。');entry.api=api;controls();return api;}).catch(error=>{status(error.message,true);throw error;});
  return entry.ready;
}
async function switchEditor(kind){
  if(busy||!Object.hasOwn(routes,kind))return;
  busy=true;controls();
  try{
    const previous=frames.get(active)?.api;if(previous)await previous.flush();
    active=kind;if(group(kind)==='covers')coverKind=kind;controls();status('正在打开编辑器…');
    await ensureFrame(kind);status('');
    document.body.dataset.studioReady='true';
    const url=new URL(location.href);url.searchParams.set('editor',kind);history.replaceState(null,'',url);
  }catch(error){status(error.message,true);}
  finally{busy=false;controls();reportHeight();}
}
async function action(callback,{allowIncomplete=false}={}){
  if(busy)return;
  const api=frames.get(active)?.api;if(!api)return;
  busy=true;controls();
  try{
    let pendingIssue='';
    try{await api.flush();}catch(error){if(!allowIncomplete)throw error;pendingIssue=error.message||'最近一次素材处理未完成。';}
    api.setBusy(true);return await callback(api,active,pendingIssue);
  }
  catch(error){status(error?.name==='AbortError'?'已取消，当前内容保留。':error.message||'操作失败，当前内容仍保留。',error?.name!=='AbortError');}
  finally{api.setBusy(false);busy=false;controls();reportHeight();}
}
function envelope(api,kind){return wrapProject(kind,structuredClone(api.getProject()));}
function stem(kind,project){return cleanFilename(projectTitle(kind,project),'未命名排版');}

$('studio-save').addEventListener('click',()=>void action(async(api,kind,pendingIssue)=>{
  const saved=envelope(api,kind),json=JSON.stringify(saved,null,2),name=`${stem(kind,saved.project)}-工程.json`;
  let handle=handles.get(kind);
  if(!handle&&typeof window.showSaveFilePicker==='function'){
    try{handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:'排版工程',accept:{'application/json':['.json']}}]});}
    catch(error){if(!['SecurityError','NotSupportedError'].includes(error.name))throw error;}
  }
  if(handle){
    if(handle.queryPermission&&await handle.queryPermission({mode:'readwrite'})!=='granted'){
      const permission=handle.requestPermission?await handle.requestPermission({mode:'readwrite'}):'denied';
      if(permission!=='granted'){handles.delete(kind);throw Error('原文件没有写入权限。再点“保存工程”可重新选文件，当前内容保留。');}
    }
    const writer=await handle.createWritable();
    try{await writer.write(json);await writer.close();}catch(error){try{await writer.abort?.();}catch{}throw error;}
    handles.set(kind,handle);api.markSaved?.(saved.project);status(`工程已保存到${handle.name||'所选文件'}。${pendingIssue?`仍需处理：${pendingIssue}`:''}`);
  }else{
    downloadBlob(new Blob([json],{type:'application/json;charset=utf-8'}),name);status(`工程JSON已生成，请保留下载文件，下次载入继续。网页无法确认文件已落盘。${pendingIssue?`仍需处理：${pendingIssue}`:''}`);
  }
},{allowIncomplete:true}));

async function acceptFile(file,handle=null){
  if(!file||file.size>MAX_PROJECT_BYTES)throw Error('请选择60MB以内的工程JSON。');
  const loaded=readProject(await file.text()),api=await ensureFrame(loaded.editor);
  try{await api.flush();}catch{/* A failed prior upload must not prevent recovery from a valid saved project. */}
  if(api.getStatus().hasChanges&&!window.confirm(`载入会替换“${names[loaded.editor]}”中的当前修改，是否继续？`))return;
  api.setBusy(true);
  try{await api.loadProject(loaded.project);}finally{api.setBusy(false);}
  handles.delete(loaded.editor);if(handle)handles.set(loaded.editor,handle);
  active=loaded.editor;if(group(active)==='covers')coverKind=active;status(`已载入${file.name}，可以继续修改。`);controls();
}
$('studio-load').addEventListener('click',async()=>{
  if(busy)return;busy=true;controls();
  const current=frames.get(active)?.api;current?.setBusy(true);
  try{
    if(typeof window.showOpenFilePicker==='function'){
      try{const handles=await window.showOpenFilePicker({multiple:false,types:[{description:'排版工程',accept:{'application/json':['.json']}}]});if(handles[0])await acceptFile(await handles[0].getFile(),handles[0]);}
      catch(error){if(['SecurityError','NotSupportedError'].includes(error.name))$('studio-project-file').click();else throw error;}
    }else $('studio-project-file').click();
  }catch(error){status(error.name==='AbortError'?'已取消，当前内容保留。':error.message,error.name!=='AbortError');}
  finally{current?.setBusy(false);busy=false;controls();}
});
$('studio-project-file').addEventListener('change',async()=>{
  const file=$('studio-project-file').files?.[0];$('studio-project-file').value='';if(!file||busy)return;
  const current=frames.get(active)?.api;busy=true;current?.setBusy(true);controls();try{await acceptFile(file);}catch(error){status(error.message,true);}finally{current?.setBusy(false);busy=false;controls();reportHeight();}
});
$('studio-export').addEventListener('click',()=>void action(async(api,kind)=>{
  status('正在生成图片…');const project=api.getProject(),images=await api.exportImages();
  if(!Array.isArray(images)||images.length===0)throw Error('当前没有可以导出的页面，请检查内容。');
  if(images.length===1){downloadBlob(images[0].blob,`${stem(kind,project)}.png`);status('PNG已生成，请查看下载文件。');}
  else{
    const files=[];for(const [index,image]of images.entries())files.push({name:`${String(index+1).padStart(3,'0')}.png`,bytes:new Uint8Array(await image.blob.arrayBuffer())});
    downloadBlob(new Blob([zipFiles(files,{maxFiles:512,maxBytes:256*1024*1024})],{type:'application/zip'}),`${stem(kind,project)}-全部图片.zip`);
    status(`已生成${images.length}页的图片ZIP，正文顺序保留。`);
  }
}));
$('studio-feedback').addEventListener('click',()=>$('feedback-dialog').showModal());
$('studio-feedback-notes').addEventListener('input',()=>{feedbackDirty=Boolean($('studio-feedback-notes').value.trim());});
$('studio-feedback-download').addEventListener('click',()=>void action(async(api,kind,pendingIssue)=>{
  const saved=envelope(api,kind),notes=$('studio-feedback-notes').value.trim(),checks=api.getStatus(),files=[{name:'project.json',bytes:new TextEncoder().encode(JSON.stringify(saved,null,2))}];
  status('正在整理反馈包…');
  let previewIssue='';try{files.push({name:'preview.png',bytes:new Uint8Array(await (await api.preview()).arrayBuffer())});}catch(error){previewIssue=error.message;}
  const description=`# 排版调整\n\n类型：${names[kind]}\n\n## 希望调整\n\n${notes||'请结合工程与预览检查排版。'}\n\n## 当前检查\n\n${[...(checks.errors||[]),previewIssue,pendingIssue].filter(Boolean).join('\n')||(checks.ok?'通过当前版面检查。':'请先核对版面。')}\n\n预览供定位与审核，错误稿不能直接发布。此包只下载，不自动发送；原母版保留，设计调整审核后另存版本。\n`;
  files.push({name:'feedback.md',bytes:new TextEncoder().encode(description)});
  downloadBlob(new Blob([zipFiles(files)],{type:'application/zip'}),`${stem(kind,saved.project)}-反馈包.zip`);feedbackDirty=false;status('反馈包已生成，下载后可交给AI继续调整。');$('feedback-dialog').close();
},{allowIncomplete:true}));
for(const button of document.querySelectorAll('[data-group]')){
  button.addEventListener('click',()=>void switchEditor(button.dataset.group==='covers'?coverKind:button.dataset.group));
  button.addEventListener('keydown',event=>{
    const keys=['ArrowLeft','ArrowRight','Home','End'];if(!keys.includes(event.key)||busy)return;event.preventDefault();
    const order=['article','moments','covers'],current=order.indexOf(group(active));
    const index=event.key==='Home'?0:event.key==='End'?2:(current+(event.key==='ArrowRight'?1:-1)+3)%3;
    document.getElementById(`tab-${order[index]}`).click();document.getElementById(`tab-${order[index]}`).focus();
  });
}
$('cover-kind').addEventListener('change',()=>void switchEditor($('cover-kind').value));
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||!event.data||typeof event.data!=='object')return;
  const entry=[...frames.values()].find(value=>value.frame.contentWindow===event.source);if(!entry)return;
  const {type,height}=event.data;
  if(type==='layout-editor-height'&&typeof height==='number'&&Number.isFinite(height))entry.frame.style.height=`${Math.max(640,Math.min(7000,Math.ceil(height)+8))}px`;
  if(type==='layout-editor-state'){controls();reportHeight();}
});
window.addEventListener('beforeunload',event=>{
  if(feedbackDirty||[...frames.values()].some(entry=>entry.api?.getStatus().hasChanges)){event.preventDefault();event.returnValue='';}
});
let heightFrame=0;
function reportHeight(){
  if(window.parent===window)return;
  cancelAnimationFrame(heightFrame);heightFrame=requestAnimationFrame(()=>{
    const height=Math.ceil(document.querySelector('.studio-shell').getBoundingClientRect().height+8);
    window.parent.postMessage({type:'moments-editor-height',height},location.origin);
    window.parent.postMessage({type:'layout-editor-height',kind:'studio',height},location.origin);
  });
}
new ResizeObserver(reportHeight).observe(document.querySelector('.studio-shell'));
window.addEventListener('resize',reportHeight);
controls();void switchEditor(active);
