import { createProject,validateProject,parseProject,serializeProject,changeLayout,DEFAULT_LAYOUTS,LIMITS,describeProject } from './model.mjs?v=e584159048f79e2b';
import { canvasMeasure,layoutProject,renderPage,dimensionsFor } from './canvas.mjs?v=e584159048f79e2b';
import { cleanFilename,downloadBlob,zipFiles } from './downloads.mjs?v=e584159048f79e2b';

const $=id=>document.getElementById(id),canvas=$('article-canvas'),form=$('editor-form');
const embedded=window.parent!==window||new URLSearchParams(location.search).get('embedded')==='1';
if(embedded)document.body.classList.add('embedded');
const contentFields={title:'title',body:'body',author:'author',account:'account','header-text':'headerText'};
const styleFields={'body-size':'bodySize','heading-size':'headingSize','line-height':'lineHeight','paragraph-gap':'paragraphGap',side:'side',top:'top',bottom:'bottom','text-align':'align','footer-style':'footerStyle'};
let project=createProject(),pageIndex=0,revision=0,lastRevision=-1,lastLayout=null,paintToken=0,loadToken=0;
let savedRevision=0,externalBusy=false,localBusy=false,initError='',frame=0,running=null;
const imageCache=new Map();
const busy=()=>externalBusy||localBusy;
const hasChanges=()=>revision!==savedRevision;
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);report();}
function notify(){if(window.parent!==window&&/^https?:$/.test(location.protocol))window.parent.postMessage({type:'layout-editor-state',kind:'article'},location.origin);}
function report(){
  if(window.parent===window||!/^https?:$/.test(location.protocol))return;
  cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>window.parent.postMessage({type:'layout-editor-height',kind:'article',height:Math.max(500,Math.min(7000,Math.ceil(document.querySelector('.article-shell').getBoundingClientRect().height+8)))},location.origin));
}
function syncDisabled(){
  for(const control of document.querySelectorAll('input,textarea,select,button'))control.disabled=busy();
  const ok=lastRevision===revision&&lastLayout?.ok&&!initError;
  for(const id of ['download-png','download-all'])$(id).disabled=busy()||!ok;
  $('prev-page').disabled=busy()||pageIndex<=0;$('next-page').disabled=busy()||!lastLayout?.pages.length||pageIndex>=lastLayout.pages.length-1;
  $('save-state').textContent=hasChanges()?'未保存':'已保存';
}
function syncControls(content=false){
  if(content)for(const [id,key] of Object.entries(contentFields))$(id).value=project.content[key];
  $('article-template').value=project.layout;$('content-mode').value=project.mode;$('canvas-format').value=project.format;$('palette').value=project.palette;
  $('mode-field').hidden=project.layout==='C';$('format-field').hidden=project.layout==='C';
  for(const [id,key] of Object.entries(styleFields)){const value=project.layouts[project.layout][key];$(id).value=String(value);const output=document.querySelector(`[data-for="${id}"]`);if(output)output.textContent=String(value);}
  $('body-count').textContent=`${Array.from(project.content.body).length}字 · 用 ## 标章节，**加粗**，__下划线__；配图标记决定插入顺序。`;
  const dimensions=dimensionsFor(project);$('dimensions').textContent=`${dimensions.width} × ${dimensions.height}`;syncDisabled();
}
function imageFor(image){
  if(!imageCache.has(image.data))imageCache.set(image.data,new Promise((resolve,reject)=>{
    const img=new Image(),timer=setTimeout(()=>{img.src='';imageCache.delete(image.data);reject(new Error(`图片${image.name}读取超时。`));},8000);
    img.onload=()=>{clearTimeout(timer);if(img.naturalWidth!==image.width||img.naturalHeight!==image.height){imageCache.delete(image.data);reject(new Error(`图片${image.name}尺寸与工程记录不一致。`));}else resolve(img);};
    img.onerror=()=>{clearTimeout(timer);imageCache.delete(image.data);reject(new Error(`图片${image.name}无法读取，请使用PNG、JPG或WebP。`));};img.src=image.data;
  }));
  return imageCache.get(image.data);
}
async function loadImages(snapshot){return new Map(await Promise.all(snapshot.images.map(async image=>[image.id,await imageFor(image)])));}
async function paint(){
  const token=++paintToken,captured=revision,snapshot=structuredClone(project);
  try{
    await document.fonts?.ready;const images=await loadImages(snapshot);if(token!==paintToken||captured!==revision)return;
    lastLayout=layoutProject(snapshot,canvasMeasure(canvas.getContext('2d')));lastRevision=captured;pageIndex=Math.min(pageIndex,Math.max(0,lastLayout.pages.length-1));initError='';
    renderPage(canvas,snapshot,lastLayout,pageIndex,images);
    $('layout-errors').textContent=lastLayout.errors.join(' ');$('layout-errors').hidden=!lastLayout.errors.length;
    const warnings=[...lastLayout.warnings];if(lastLayout.pages.length>18)warnings.push(`当前共${lastLayout.pages.length}页。小红书图片数量需按实际发布入口人工确认，未自动截页或拆篇。`);
    $('layout-warnings').textContent=warnings.join(' ');$('layout-warnings').hidden=!warnings.length;
    $('page-count').textContent=lastLayout.pages.length?`${pageIndex+1} / ${lastLayout.pages.length}`:'—';
    if($('status').textContent==='正在准备预览…')status('');
    document.body.dataset.editorReady='true';
  }catch(error){initError=error.message||'预览暂时不可用，原文仍保留。';$('layout-errors').textContent=initError;$('layout-errors').hidden=false;}
  syncDisabled();report();notify();
}
function commit(next,{content=false,gallery=false}={}){project=next;revision++;status('');syncControls(content);if(gallery)renderGallery();void paint();notify();}
function capture(){return{project:validateProject(project),revision};}
function assertFresh(value){if(value!==revision)throw new Error('稿件已发生变化，请按当前工程重新导出。');}
function action(callback){
  if(busy())return Promise.resolve();
  const task=(async()=>{localBusy=true;syncDisabled();notify();try{await callback();}catch(error){status(error.name==='AbortError'?'已取消，当前稿件仍保留。':error.message||'操作失败，当前稿件仍保留。',error.name!=='AbortError');}finally{localBusy=false;syncDisabled();report();notify();}})();
  running=task;void task.finally(()=>{if(running===task)running=null;});return task;
}
async function png(snapshot,index,allowErrors=false){
  await document.fonts?.ready;const images=await loadImages(snapshot),target=document.createElement('canvas');
  const layout=layoutProject(snapshot,canvasMeasure(target.getContext('2d')));
  if(!allowErrors&&!layout.ok)throw new Error(layout.errors.join(' '));
  renderPage(target,snapshot,layout,Math.min(index,Math.max(0,layout.pages.length-1)),images);
  const blob=await new Promise((resolve,reject)=>target.toBlob(blob=>blob?resolve(blob):reject(new Error('图片生成失败。')),'image/png'));
  return{blob,layout};
}
async function exportImages(){
  const snapshot=capture(),previous=localBusy;localBusy=true;syncDisabled();
  try{
    await document.fonts?.ready;const images=await loadImages(snapshot.project),target=document.createElement('canvas'),layout=layoutProject(snapshot.project,canvasMeasure(target.getContext('2d')));
    if(!layout.ok)throw new Error(layout.errors.join(' '));const files=[];
    for(let index=0;index<layout.pages.length;index++){
      assertFresh(snapshot.revision);renderPage(target,snapshot.project,layout,index,images);
      const blob=await new Promise((resolve,reject)=>target.toBlob(blob=>blob?resolve(blob):reject(new Error('图片生成失败。')),'image/png'));
      files.push({name:`${cleanFilename(snapshot.project.content.title)}-${String(index+1).padStart(2,'0')}.png`,blob});
    }
    assertFresh(snapshot.revision);return files;
  }finally{localBusy=previous;syncDisabled();notify();}
}
async function applyProject(value){
  const next=validateProject(value),token=++loadToken,previous=localBusy;localBusy=true;syncDisabled();
  try{
    await document.fonts?.ready;await loadImages(next);if(token!==loadToken)throw new Error('另一份工程正在载入，请稍后重试。');
    project=next;revision++;pageIndex=0;savedRevision=revision;$('feedback-notes').value='';status('');syncControls(true);renderGallery();await paint();
  }finally{localBusy=previous;syncDisabled();report();notify();}
}
async function loadProject(value){
  const next=validateProject(value);
  if(running)await running;
  await applyProject(next);
}
function insertMarker(next,image,position=$('body').selectionStart){
  const caption=image.name.replace(/\.[^.]+$/,'').replace(/[\[\]\r\n]/g,' '),marker=`\n\n![${caption}](${image.id})\n\n`;
  next.content.body=next.content.body.slice(0,position)+marker+next.content.body.slice(position);return position+marker.length;
}
function renderGallery(){
  const container=$('image-list');container.replaceChildren();
  for(const image of project.images){
    const row=document.createElement('div');row.className='image-row';const thumbnail=document.createElement('img');thumbnail.src=image.data;thumbnail.alt='';
    const name=document.createElement('span');name.textContent=`${image.name} · ${image.id}`;const actions=document.createElement('div');actions.className='image-row-actions';
    const insert=document.createElement('button');insert.type='button';insert.textContent='插入';insert.dataset.image=image.id;
    insert.onclick=()=>{if(busy())return;const next=structuredClone(project),cursor=insertMarker(next,image);commit(next,{content:true});$('body').focus();$('body').setSelectionRange(cursor,cursor);};
    const remove=document.createElement('button');remove.type='button';remove.textContent='移除';remove.dataset.remove=image.id;
    remove.onclick=()=>{if(busy()||!window.confirm('移除此图片及正文中对应的图片标记？'))return;const next=structuredClone(project);next.images=next.images.filter(item=>item.id!==image.id);next.content.body=next.content.body.replace(new RegExp(`^!\\[[^\\]]*\\]\\(${image.id}\\)\\s*$`,'gm'),'');commit(next,{content:true,gallery:true});};
    actions.append(insert,remove);row.append(thumbnail,name,actions);container.append(row);
  }
}
const readData=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('图片文件无法读取。'));reader.readAsDataURL(file);});
async function uploadImages(files){
  const next=validateProject(project),captured=revision;if(next.images.length+files.length>LIMITS.images)throw new Error(`最多使用${LIMITS.images}张配图。`);let cursor=$('body').selectionStart;
  for(const file of files){
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('请选择5MB以内的PNG、JPG或WebP图片。');
    const data=await readData(file),img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('图片格式无法读取。'));img.src=data;});
    let id=1;while(next.images.some(image=>image.id===`image-${id}`))id++;const image={id:`image-${id}`,name:file.name.slice(0,160),data,width:img.naturalWidth,height:img.naturalHeight};
    next.images.push(image);cursor=insertMarker(next,image,cursor);
  }
  validateProject(next);await loadImages(next);assertFresh(captured);commit(next,{content:true,gallery:true});$('body').setSelectionRange(cursor,cursor);status('图片已按顺序插入正文，可移动图片标记调整顺序。');
}

for(const [id,key] of Object.entries(contentFields))$(id).addEventListener('input',()=>{if(busy())return;const next=structuredClone(project);next.content[key]=$(id).value;commit(next);});
for(const [id,key] of Object.entries(styleFields))$(id).addEventListener('input',()=>{if(busy())return;const next=structuredClone(project);next.layouts[next.layout][key]=$(id).type==='range'?Number($(id).value):$(id).value;commit(next);});
$('article-template').onchange=()=>{if(!busy())commit(changeLayout(project,$('article-template').value));};
for(const [id,key] of [['content-mode','mode'],['canvas-format','format'],['palette','palette']])$(id).onchange=()=>{
  if(busy())return;const next=structuredClone(project),value=$(id).value;
  if(key==='mode'&&next.layouts.A.lineHeight===(next.mode==='text'?1.85:1.9)){next.layouts.A.lineHeight=value==='text'?1.85:1.9;next.layouts.A.paragraphGap=value==='text'?22:34;}
  next[key]=value;commit(next);
};
$('reset-layout').onclick=()=>{if(busy())return;const next=structuredClone(project);next.layouts[next.layout]=structuredClone(DEFAULT_LAYOUTS[next.layout]);if(next.layout==='A'&&next.mode==='text'){next.layouts.A.lineHeight=1.85;next.layouts.A.paragraphGap=22;}commit(next);};
$('prev-page').onclick=()=>{if(!busy()&&pageIndex>0){pageIndex--;void paint();}};
$('next-page').onclick=()=>{if(!busy()&&pageIndex<(lastLayout?.pages.length||0)-1){pageIndex++;void paint();}};
$('add-image').onclick=()=>$('image-file').click();
$('image-file').onchange=()=>{const files=Array.from($('image-file').files||[]);$('image-file').value='';if(files.length)void action(()=>uploadImages(files));};
$('import-text').onclick=()=>$('text-file').click();
$('text-file').onchange=()=>{const file=$('text-file').files?.[0];$('text-file').value='';if(!file)return;void action(async()=>{
  if(file.size>400000)throw new Error('请选择400KB以内的MD或TXT文件。');const body=await file.text();if(body.length>LIMITS.text)throw new Error(`正文超过${LIMITS.text}字，请拆为独立工程。`);
  if(project.content.body&&hasChanges()&&!window.confirm('用文件内容替换当前正文？'))return;const next=structuredClone(project);next.content.body=body;commit(next,{content:true});
});};
$('download-png').onclick=()=>void action(async()=>{const snapshot=capture(),result=await png(snapshot.project,pageIndex);assertFresh(snapshot.revision);downloadBlob(result.blob,`${cleanFilename(snapshot.project.content.title)}-${String(pageIndex+1).padStart(2,'0')}.png`);status('本页PNG已生成。');});
$('download-all').onclick=()=>void action(async()=>{
  const files=await exportImages(),bytes=await Promise.all(files.map(async file=>({name:file.name,bytes:new Uint8Array(await file.blob.arrayBuffer())})));
  downloadBlob(new Blob([zipFiles(bytes)],{type:'application/zip'}),`${cleanFilename(project.content.title)}-全部图片.zip`);status(`已生成${files.length}张PNG的完整ZIP。`);
});
$('save-project').onclick=()=>void action(async()=>{downloadBlob(new Blob([serializeProject(project)],{type:'application/json;charset=utf-8'}),`${cleanFilename(project.content.title)}-工程.json`);status('工程JSON已生成，请保留下载文件。网页无法确认落盘，仍保留未保存状态。');});
$('load-project').onclick=()=>$('project-file').click();
$('project-file').onchange=()=>{const file=$('project-file').files?.[0];$('project-file').value='';if(!file)return;void action(async()=>{if(file.size>LIMITS.totalImageData+1500000)throw new Error('工程文件过大。');const next=parseProject(await file.text());if(hasChanges()&&!window.confirm('载入会替换当前未保存的修改，是否继续？'))return;await applyProject(next);status('工程已载入，文字、图片和两种阅读参数均已恢复。');});};
$('download-feedback').onclick=()=>void action(async()=>{const snapshot=capture(),result=await png(snapshot.project,pageIndex,true),notes=$('feedback-notes').value.trim();assertFresh(snapshot.revision);const encoder=new TextEncoder(),files=[{name:'project.json',bytes:encoder.encode(serializeProject(snapshot.project))},{name:'preview.png',bytes:new Uint8Array(await result.blob.arrayBuffer())},{name:'feedback.md',bytes:encoder.encode(`${describeProject(snapshot.project)}\n希望调整：\n${notes||'请结合工程和预览检查。'}\n\n${result.layout.ok?'版面检查通过。':`仅供问题定位，不能发布：${result.layout.errors.join(' ')}`}\n反馈包只下载，不自动发送。`)}];downloadBlob(new Blob([zipFiles(files)],{type:'application/zip'}),`${cleanFilename(snapshot.project.content.title)}-反馈包.zip`);status('反馈包已生成，请下载后交给AI。');});
form.onsubmit=event=>event.preventDefault();
window.addEventListener('beforeunload',event=>{if(hasChanges()) {event.preventDefault();event.returnValue='';}});
window.addEventListener('resize',report);
if(typeof ResizeObserver==='function')new ResizeObserver(report).observe(document.querySelector('.article-shell'));
window.layoutEditor={
  kind:'article',getProject:()=>validateProject(project),loadProject,exportImages,
  preview:async()=>{const snapshot=capture(),result=await png(snapshot.project,pageIndex,true);assertFresh(snapshot.revision);return result.blob;},
  getStatus:()=>({ok:!localBusy&&lastRevision===revision&&Boolean(lastLayout?.ok)&&!initError,errors:[...(lastLayout?.errors||[]),...(initError?[initError]:[])],hasChanges:hasChanges()}),
  setBusy:value=>{externalBusy=Boolean(value);syncDisabled();},flush:async()=>{if(running)await running;await paint();},
  markSaved:value=>{if(serializeProject(value)===serializeProject(project)){savedRevision=revision;syncDisabled();notify();}},
};
syncControls(true);renderGallery();void paint();
