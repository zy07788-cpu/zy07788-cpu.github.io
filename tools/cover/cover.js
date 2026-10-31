const assets=window.ASSETS, profile=window.EDITOR_PROFILE||'cover', library=window.ART_LIBRARY, presets=window.STUDIO_PRESETS[profile], model=window.CoverModel, images={};
const $=id=>document.getElementById(id), clone=value=>JSON.parse(JSON.stringify(value));
const artNames=Object.fromEntries(library.map(a=>[a.id,a.name]));artNames.custom='自己的底图';
const commonColors=['#3f5149','#6f8b79','#567c91','#a3b6b4','#ba8d80','#c5ac6d','#303533','#102923','#315c8a','#c94f3d','#fffaf0','#ffffff'];
const loadImage=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('图片无法读取，请选择 PNG、JPG 或 WebP。'));img.src=src;});
const makeCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const layout=(x,y,size,width=700,lineHeight=1.2)=>({x,y,size,width,lineHeight,align:'left'});
const createState=(art='ivory',sample=false,presetId)=>model.createState(profile,library,presets,art,sample,presetId);
const dimensionsFor=s=>model.dimensionsFor(profile,s);
let state=createState('ivory',true), mode='wide', selectedId='title', hitboxes=[], drag=null, stateLoadVersion=0;
const imageLoads=new Map();
async function ensureArt(art){
 if(images[art])return images[art];
 if(!assets[art])throw new Error('找不到这张底图，请重新选择。');
 if(!imageLoads.has(art))imageLoads.set(art,loadImage(assets[art]).then(img=>(images[art]=img)).catch(error=>{imageLoads.delete(art);throw error;}));
 return imageLoads.get(art);
}
let draftDB=null, draftEnabled=false, draftTimer=null, observedDraft='', draftRevision=0;
const draftScope=location.pathname;
const draftMessage=message=>$('draftStatus').textContent=message;
const draftSnapshot=()=>({state:clone(state),mode});
function openDraftDB(){
 return new Promise((resolve,reject)=>{
  if(!window.indexedDB){reject(new Error('当前浏览器不支持本机暂存'));return;}
  let settled=false;const request=indexedDB.open('xunpu-cover-editor',1);
  const finish=(error,db)=>{if(settled){if(db)db.close();return;}settled=true;clearTimeout(timer);error?reject(error):resolve(db);};
  const timer=setTimeout(()=>finish(new Error('本机暂存打开超时')),3500);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('drafts'))request.result.createObjectStore('drafts');};
  request.onsuccess=()=>finish(null,request.result);request.onerror=()=>finish(request.error||new Error('本机暂存不可用'));request.onblocked=()=>finish(new Error('本机暂存被其他页面占用'));
 });
}
function readDraft(){return new Promise((resolve,reject)=>{const tx=draftDB.transaction('drafts','readonly'),request=tx.objectStore('drafts').get(draftScope);let result;const timer=setTimeout(()=>{reject(new Error('读取本机暂存超时'));try{tx.abort();}catch{}},3500);request.onsuccess=()=>result=request.result;tx.oncomplete=()=>{clearTimeout(timer);resolve(result);};tx.onerror=()=>{clearTimeout(timer);reject(tx.error||new Error('无法读取本机暂存'));};tx.onabort=()=>{clearTimeout(timer);reject(tx.error||new Error('读取本机暂存中断'));};});}
function writeDraft(snapshot){return new Promise((resolve,reject)=>{const tx=draftDB.transaction('drafts','readwrite');tx.objectStore('drafts').put({...snapshot,savedAt:Date.now()},draftScope);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('无法保存本机暂存'));tx.onabort=()=>reject(tx.error||new Error('保存本机暂存中断'));});}
async function flushDraft(){
 clearTimeout(draftTimer);draftTimer=null;if(!draftEnabled)return false;const revision=draftRevision,snapshot=draftSnapshot();
 try{await writeDraft(snapshot);if(revision===draftRevision)draftMessage('已自动暂存到本机 · 不会云同步');return true;}catch(e){draftEnabled=false;draftMessage('自动暂存失败，请点「保存方案」手动留存。');return false;}
}
function scheduleDraft(){
 if(!draftEnabled)return;const next=JSON.stringify({state,mode});if(next===observedDraft)return;observedDraft=next;draftRevision++;clearTimeout(draftTimer);draftMessage('正在暂存到本机…');draftTimer=setTimeout(flushDraft,450);
}
async function restoreDraft(){
 try{
  draftDB=await openDraftDB();draftDB.onversionchange=()=>{draftEnabled=false;draftDB.close();draftMessage('本机暂存连接已更新，请先保存方案再刷新。');};
  const saved=await readDraft(),hasSaved=saved!==undefined;if(hasSaved){await loadState(saved?.state);mode=saved.mode==='square'?'square':'wide';refresh();}
  observedDraft=JSON.stringify({state,mode});draftEnabled=true;draftMessage(hasSaved?'已恢复上次方案 · 仅保存在本机':'修改后自动暂存到本机 · 不会云同步');return hasSaved;
 }catch(e){draftEnabled=false;draftMessage('本机暂存无法恢复，未覆盖旧草稿。请用「载入方案」恢复，并手动「保存方案」。');return false;}
}

const current=()=>state.elements.find(e=>e.id===selectedId);
function fontOf(e,size){return e.font==='cn'?`600 ${size}px CoverCN, CoverEN, serif`:e.font==='en'?`400 ${size}px CoverEN, CoverCN, serif`:`500 ${size}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;}
function fitImage(ctx,img,x,y,w,h,view){const scale=Math.max(w/img.width,h/img.height)*view.zoom,sw=w/scale,sh=h/scale;ctx.drawImage(img,(img.width-sw)*view.focusX,(img.height-sh)*view.focusY,sw,sh,x,y,w,h);}
function background(ctx,s,aspect){
 const [w,h]=dimensionsFor(s)[aspect],img=images[s.art],view=s.background[aspect];ctx.fillStyle=s.paper;ctx.fillRect(0,0,w,h);
 if(!img)return;
 if(aspect==='square'&&view.mode==='editorial'){
  fitImage(ctx,img,0,h*.4375,w,h*.5625,view);
  const fade=ctx.createLinearGradient(0,h*.4375,0,h*.519);fade.addColorStop(0,s.paper);fade.addColorStop(1,s.paper+'00');ctx.fillStyle=fade;ctx.fillRect(0,h*.4375,w,h*.082);
 }else if(s.style==='frame'){
  // Keep photo framing separate from the artwork so uploads remain editable.
  const x=w*.075,y=h*(aspect==='wide'?.52:.55),iw=w*.85,ih=h-y-h*.07;
  const paper=images.ivory;if(paper)fitImage(ctx,paper,0,0,w,h,{focusX:.5,focusY:.5,zoom:1});
  ctx.save();ctx.shadowColor='#303b3124';ctx.shadowBlur=w*.012;ctx.shadowOffsetY=h*.005;ctx.fillStyle='#fcfaf2';ctx.fillRect(x-12,y-12,iw+24,ih+24);ctx.restore();fitImage(ctx,img,x,y,iw,ih,view);
 }else{
  fitImage(ctx,img,0,0,w,h,view);
  if(s.style==='fade'){
   const g=profile==='poster'||aspect==='square'?ctx.createLinearGradient(0,h*.1,0,h*.85):ctx.createLinearGradient(0,0,w*.72,0);
   g.addColorStop(0,s.paper+'f5');g.addColorStop(.38,s.paper+'df');g.addColorStop(1,s.paper+'00');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  }else if(s.style==='immersive'){
   const g=ctx.createLinearGradient(0,0,0,h*.83);g.addColorStop(0,'#102520b5');g.addColorStop(.55,'#10252080');g.addColorStop(1,'#10252000');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  }
 }
}
function wrapText(ctx,value,width){
 const lines=[];
 for(const paragraph of value.split('\n')){
  if(!paragraph){lines.push('');continue;}
  let line='';for(const char of Array.from(paragraph)){if(line&&ctx.measureText(line+char).width>width){lines.push(line);line=char;}else line+=char;}lines.push(line);
 }
 return lines;
}
const logoAlphaBounds=new WeakMap();
function isBrand(e){return e.type==='text'&&['brandCN','brandEN'].includes(e.id);}
function isBrandAligned(e,aspect){return isBrand(e)&&e.alignLogoBottom?.[aspect]!==false;}
function setBrandAlignment(e,aspect,enabled){if(isBrand(e))e.alignLogoBottom={wide:e.alignLogoBottom?.wide!==false,square:e.alignLogoBottom?.square!==false,[aspect]:enabled};}
function logoImage(s){return(s.customLogo?images.customLogo:null)||images.logo;}
function visibleLogoBounds(img){
 if(img===images.logo)return{left:3.5/44,top:3.5/44,right:40.5/44,bottom:40.5/44};
 if(logoAlphaBounds.has(img))return logoAlphaBounds.get(img);
 const scale=Math.min(1,1024/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));
 const c=makeCanvas(w,h),ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,w,h);const pixels=ctx.getImageData(0,0,w,h).data;let left=w,top=h,right=-1,bottom=-1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[(y*w+x)*4+3]>0){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 const bounds=right<0?null:{left:left/w,top:top/h,right:(right+1)/w,bottom:(bottom+1)/h};logoAlphaBounds.set(img,bounds);return bounds;
}
function logoGeometry(s,e,aspect){const img=logoImage(s),l=e.layout[aspect],height=l.size*img.height/img.width,bounds=visibleLogoBounds(img);return{img,height,box:bounds?{x:l.x+l.size*bounds.left,y:l.y+height*bounds.top,width:l.size*(bounds.right-bounds.left),height:height*(bounds.bottom-bounds.top)}:null};}
function alignedLogoBottom(s,aspect){const e=s.elements.find(item=>item.type==='logo'&&item.enabled&&item.opacity>0);if(!e)return null;const box=logoGeometry(s,e,aspect).box;return box?box.y+box.height:null;}
let measurementContext;
function textGeometry(s,e,aspect,ctx){
 if(!ctx)ctx=measurementContext||(measurementContext=makeCanvas(1,1).getContext('2d'));
 const l=e.layout[aspect];ctx.font=fontOf(e,l.size);ctx.textBaseline='top';ctx.textAlign=l.align;
 const lines=wrapText(ctx,e.text,l.width),x=l.x+(l.align==='center'?l.width/2:l.align==='right'?l.width:0);let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
 lines.forEach((line,i)=>{if(!line.trim())return;const m=ctx.measureText(line),offset=i*l.size*l.lineHeight;left=Math.min(left,x-m.actualBoundingBoxLeft);right=Math.max(right,x+m.actualBoundingBoxRight);top=Math.min(top,offset-m.actualBoundingBoxAscent);bottom=Math.max(bottom,offset+m.actualBoundingBoxDescent);});
 if(!Number.isFinite(top)){left=l.x;right=l.x;top=0;bottom=0;}
 const logoBottom=isBrandAligned(e,aspect)?alignedLogoBottom(s,aspect):null,y=logoBottom===null?l.y:logoBottom-bottom;
 return{lines,x,y,box:{x:left,y:y+top,width:right-left,height:bottom-top}};
}
function renderAlignmentControls(e=current()){
 const brand=Boolean(e&&isBrand(e));$('brandAlignmentControl').classList.toggle('hidden',!brand);$('alignLogoBottom').checked=brand&&isBrandAligned(e,mode);
 if(e&&document.activeElement!==$('elementY'))$('elementY').value=Math.round((e.type==='text'?textGeometry(state,e,mode).y:e.layout[mode].y)*100)/100;
}
function renderColorSwatches(){
 const e=current();if(e)$('elementColor').value=e.color;
 for(const [id,color]of [['elementSwatches',e?.color],['paperSwatches',state.paper]])for(const button of $(id).querySelectorAll('button')){const active=button.dataset.color.toLowerCase()===color?.toLowerCase();button.classList.toggle('chosen',active);button.setAttribute('aria-pressed',String(active));}
}
function draw(s,aspect,{backgroundOnly=false,selection=false,target=null}={}){
 const [w,h]=dimensionsFor(s)[aspect],canvas=target||makeCanvas(w,h);if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
 const ctx=canvas.getContext('2d');ctx.clearRect(0,0,w,h);background(ctx,s,aspect);const boxes=[],warnings=[];
 if(!backgroundOnly) for(const e of s.elements){
  if(!e.enabled||e.opacity<=0)continue;
  const l=e.layout[aspect];ctx.save();ctx.globalAlpha=e.opacity;let b;
  if(e.type==='text'){
   if(!e.text.trim()){ctx.restore();continue;}
   const geometry=textGeometry(s,e,aspect,ctx);ctx.fillStyle=e.color;
   geometry.lines.forEach((line,i)=>ctx.fillText(line,geometry.x,geometry.y+i*l.size*l.lineHeight));b=geometry.box;
  }else if(e.type==='logo'){
   const geometry=logoGeometry(s,e,aspect);ctx.drawImage(geometry.img,l.x,l.y,l.size,geometry.height);b=geometry.box||{x:l.x,y:l.y,width:0,height:0};
  }else{ctx.fillStyle=e.color;ctx.fillRect(l.x,l.y,l.width,l.size);b={x:l.x,y:l.y,width:l.width,height:l.size};}
  ctx.restore();boxes.push({...b,id:e.id});
  if(b.x<0||b.y<0||b.x+b.width>w+1||b.y+b.height>h+1)warnings.push(e.name+' 超出画布，请调整位置、字号或文本框宽度。');
 }
 if(selection){const b=boxes.find(b=>b.id===selectedId);if(b){ctx.save();ctx.lineWidth=2;ctx.setLineDash([9,7]);ctx.strokeStyle='#a36d45';ctx.strokeRect(b.x-7,b.y-7,b.width+14,b.height+14);ctx.restore();}}
 return {canvas,boxes,warnings};
}
function redraw(){
 const result=draw(state,mode,{target:$('preview'),selection:true});hitboxes=result.boxes;$('warnings').textContent=[...new Set(result.warnings)].join('\n');
 $('preview').dataset.mode=mode;$('canvasShell').classList.toggle('square',mode==='square');$('dimensions').textContent=dimensionsFor(state)[mode].join(' × ');
 for(const [id,value]of [['modeWide','wide'],['modeSquare','square']]){$(id).classList.toggle('active',mode===value);$(id).setAttribute('aria-pressed',String(mode===value));}scheduleDraft();
}
function status(message){$('status').textContent=message;}
function renderLayers(){
 const root=$('layers');root.replaceChildren();
 [...state.elements].reverse().forEach(e=>{
  const row=document.createElement('div');row.className='layer'+(selectedId===e.id?' selected':'')+(!e.enabled?' off':'');row.dataset.elementId=e.id;
  const toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=e.enabled;toggle.setAttribute('aria-label','显示'+e.name);toggle.onchange=()=>{e.enabled=toggle.checked;selectedId=e.id;refresh();};
  const button=document.createElement('button');button.type='button';button.dataset.selectElement=e.id;
  const title=document.createElement('span');title.className='layer-name';title.textContent=e.name;button.append(title);
  if(e.type==='text'){const sub=document.createElement('small');sub.textContent=e.text.replace(/\n/g,' / ')||'未填写';button.append(sub);}
  button.onclick=()=>{selectedId=e.id;refresh();};row.append(toggle,button);root.append(row);
 });
}
function renderProperties(){
 const e=current();$('properties').classList.toggle('hidden',!e);$('emptyProperty').classList.toggle('hidden',Boolean(e));$('propertyTitle').textContent=e?e.name:'元素属性';if(!e)return;
 const l=e.layout[mode];$('elementEnabled').checked=e.enabled;$('textControls').classList.toggle('hidden',e.type!=='text');$('textLayoutControls').classList.toggle('hidden',e.type!=='text');
 $('elementText').value=e.text||'';$('elementFont').value=e.font||'cn';$('elementColor').value=e.color||'#102923';$('elementSize').value=l.size;$('elementOpacity').value=Math.round(e.opacity*100);
 $('elementX').value=Math.round(l.x);$('elementY').value=Math.round(l.y);$('elementWidth').value=l.width;$('elementLineHeight').value=l.lineHeight;$('elementAlign').value=l.align;
 $('sizeLabel').textContent=e.type==='logo'?'标志宽度':e.type==='rule'?'线条粗细':'字号';$('elementSize').min=e.type==='rule'?1:8;
 const i=state.elements.indexOf(e);$('moveUp').disabled=i===state.elements.length-1;$('moveDown').disabled=i===0;
 // Line width and color should also remain editable.
 if(e.type==='rule'){$('textLayoutControls').classList.remove('hidden');$('textControls').classList.remove('hidden');$('elementText').closest('label').classList.add('hidden');$('elementFont').closest('label').classList.add('hidden');$('elementLineHeight').closest('label').classList.add('hidden');$('elementAlign').closest('label').classList.add('hidden');}
 else{for(const id of ['elementText','elementFont','elementLineHeight','elementAlign'])$(id).closest('label').classList.remove('hidden');}
 renderAlignmentControls(e);renderColorSwatches();
}
function renderBackgroundControls(){const v=state.background[mode];$('paperColor').value=state.paper;$('squareBgMode').value=state.background.square.mode;$('focusX').value=v.focusX*100;$('focusY').value=v.focusY*100;$('bgZoom').value=v.zoom*100;
 if(state.customBackground&&!$('artSelect').querySelector('[value="custom"]')){const o=document.createElement('option');o.value='custom';o.textContent='自己的底图';$('artSelect').append(o);}$('artSelect').value=state.art;$('posterFormat').value=state.format;
 for(const button of $('artGallery').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.art===state.art));
 renderColorSwatches();}
function renderQuickFields(){for(const id of ['title','subtitle','author']){const e=state.elements.find(item=>item.id===id&&item.type==='text'),input=$('quick-'+id);if(input.value!==(e?.text||''))input.value=e?.text||'';$('quick-'+id+'-enabled').checked=Boolean(e?.enabled);}}
function quickLayer(id){let e=state.elements.find(item=>item.id===id&&item.type==='text');if(e)return e;if(state.elements.some(item=>item.id===id)){status('此快捷字段对应的元素类型已更改，请在右侧元素列表中编辑。');return null;}if(state.elements.length>=50){status('最多保留50个元素，请先删除一个元素。');return null;}e=createState(state.art==='custom'?'ivory':state.art).elements.find(item=>item.id===id);state.elements.push(e);return e;}
function refresh(){renderLayers();renderProperties();renderBackgroundControls();renderQuickFields();redraw();}
function setMode(value){mode=value;refresh();}
function changeLayer(fn){const e=current();if(!e)return;fn(e,e.layout[mode]);renderLayers();renderQuickFields();renderAlignmentControls(e);renderColorSwatches();redraw();}
function numberInput(id,fn,min,max){$(id).oninput=()=>{const n=$(id).valueAsNumber;if(!Number.isFinite(n))return;changeLayer((e,l)=>fn(e,l,Math.min(max,Math.max(min,n))));};}
let exportURL=null,exportGeneration=0;
function showExport(blob,name,{image=false,width=0,height=0}={}){
 const preview=$('exportPreview'),link=$('exportLink');preview.removeAttribute('src');link.removeAttribute('href');if(exportURL)URL.revokeObjectURL(exportURL);exportURL=URL.createObjectURL(blob);
 link.href=exportURL;link.download=name;link.textContent=image?'下载图片':'下载方案 JSON';$('exportFilename').textContent=name;$('exportTitle').textContent=image?'封面已生成':'方案已生成';
 preview.hidden=!image;if(image){preview.src=exportURL;preview.alt='导出的干净封面，'+width+' × '+height;}$('exportDetails').textContent=image?width+' × '+height+' px · '+(blob.type==='image/png'?'PNG':'JPG'):'下次用「载入方案」继续编辑，图片与排版一起保留。';
 $('exportHelp').textContent=image?'点击下载；若没有反应，可右键图片选择「图片另存为」。':'点击下载；若没有反应，可右键下载链接选择「链接另存为」。';
 if(!$('exportDialog').open)$('exportDialog').showModal();status(image?'封面已生成，请下载图片。':'方案已生成，请下载 JSON 文件留存。');
}
function filename(suffix){return (profile==='poster'?'图文-':'公众号-')+(state.art==='custom'?(state.customLabel||'自己的底图'):(artNames[state.art]||'封面'))+'-'+suffix;}
async function downloadCanvas(c,suffix){const format=$('format').value,name=filename(suffix)+(format==='png'?'.png':'.jpg'),generation=++exportGeneration;status('正在生成图片…');try{const blob=await new Promise((resolve,reject)=>c.toBlob(value=>value?resolve(value):reject(new Error('无法生成图片，请重试。')),'image/'+format,.94));if(generation!==exportGeneration)return;showExport(blob,name,{image:true,width:c.width,height:c.height});}catch(e){if(generation===exportGeneration)status('生成失败：'+e.message);}}
function uploadSheet(s){const result=makeCanvas(1880,1600),c=result.getContext('2d');c.fillStyle=s.paper;c.fillRect(0,0,1880,1600);c.drawImage(draw(s,'wide').canvas,0,0);c.drawImage(draw(s,'square').canvas,540,800);return result;}
function fileData(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('无法读取文件。'));r.readAsDataURL(file);});}
function validDataImage(value){return typeof value==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value);}
function validateState(input){
 return model.validateState(input,profile,library);
}
async function loadState(value){const next=validateState(value),loaded={},version=++stateLoadVersion;if(next.art!=='custom')await ensureArt(next.art);if(next.customBackground)loaded.custom=await loadImage(next.customBackground);if(next.customLogo)loaded.customLogo=await loadImage(next.customLogo);if(version!==stateLoadVersion)return false;delete images.custom;delete images.customLogo;Object.assign(images,loaded);state=next;selectedId=state.elements.find(e=>e.id==='title')?.id||state.elements[0]?.id||null;if(state.material)restoreMaterialControls(state.material);$('templateSelect').value=presets.find(p=>p.id===state.templateId)?.id||presets.find(p=>p.art===state.art)?.id||'blank';refresh();status('方案已载入，文字、位置和图片均已恢复。');return true;}
async function uploadImage(input,type){
 const file=input.files[0];if(!file)return;const version=++stateLoadVersion;
 try{if(file.size>20*1024*1024)throw new Error('请选择20MB以内的图片。');const data=await fileData(file);if(!validDataImage(data))throw new Error('请选择 PNG、JPG 或 WebP 图片。');const img=await loadImage(data);
 if(version!==stateLoadVersion)return;
 if(type==='background'){images.custom=img;state.customBackground=data;state.art='custom';state.customLabel='上传图片';state.material=null;}else{images.customLogo=img;state.customLogo=data;let logo=state.elements.find(e=>e.type==='logo');if(!logo){logo=createState().elements.find(e=>e.id==='logo');state.elements.push(logo);}logo.enabled=true;selectedId=logo.id;}
 refresh();status('图片已替换；保存方案会一起保存图片。');
 }catch(e){status(e.message);}finally{input.value='';}
}
async function selectArt(art){
 const version=++stateLoadVersion;
 try{if(art==='custom'){if(!images.custom)throw new Error('请先上传或生成一张底图。');}else await ensureArt(art);
  if(version!==stateLoadVersion)return;state.art=art;
  for(const aspect of ['wide','square'])Object.assign(state.background[aspect],{focusX:.5,focusY:.65,zoom:1});
  refresh();status('底图已更换，现有文字与排版保留。');
 }catch(e){status(e.message);renderBackgroundControls();}
}
function renderArtGallery(){
 const group=$('artCategory').value,root=$('artGallery');root.replaceChildren();
 for(const art of library.filter(art=>group==='all'||art.group===group)){
  const button=document.createElement('button');button.type='button';button.className='art-tile';button.dataset.art=art.id;button.setAttribute('aria-label','使用底图：'+art.name);button.setAttribute('aria-pressed',String(state.art===art.id));
  const img=document.createElement('img');img.src=assets[art.id];img.alt='';img.loading='lazy';img.width=160;img.height=90;
  const label=document.createElement('span');label.textContent=art.name;button.append(img,label);button.onclick=()=>void selectArt(art.id);root.append(button);
 }
}
let materialSeed=42;
function materialOptions(){return{style:$('materialStyle').value,base:$('materialBase').value,accent:$('materialAccent').value,seed:materialSeed,intensity:Number($('materialIntensity').value)};}
function previewMaterial(){try{window.CoverTextures.render($('materialPreview'),materialOptions());}catch(e){status(e.message);}}
function restoreMaterialControls(recipe){materialSeed=recipe.seed;for(const [id,key]of [['materialStyle','style'],['materialBase','base'],['materialAccent','accent'],['materialIntensity','intensity']])$(id).value=recipe[key];previewMaterial();}
async function applyMaterial(){
 const version=++stateLoadVersion,button=$('applyMaterial');button.disabled=true;status('正在生成材质底图…');
 try{
  const recipe=materialOptions(),[w,h]=dimensionsFor(state).wide,c=makeCanvas(w,h);window.CoverTextures.render(c,recipe);
  const data=c.toDataURL('image/png'),image=await loadImage(data);if(version!==stateLoadVersion)return;
  images.custom=image;state.customBackground=data;state.art='custom';state.material=recipe;state.customLabel={paper:'自选纸张',canvas:'自选画布',wash:'自选淡彩',cutpaper:'自选拼纸'}[recipe.style];state.paper=recipe.base;state.style='full';
  for(const aspect of ['wide','square'])Object.assign(state.background[aspect],{focusX:.5,focusY:.5,zoom:1});state.background.square.mode='cover';
  refresh();status('底图已生成，现有文字保留。保存方案可一并保留颜色与材质。');
 }catch(e){status('未生成：'+e.message);}finally{button.disabled=false;}
}
function configureStudio(){
 const template=$('templateSelect'),blank=document.createElement('option');blank.value='blank';blank.textContent='纯底图 · 自由排版';template.append(blank);
 for(const preset of presets){const option=document.createElement('option');option.value=preset.id;option.textContent=preset.name;template.append(option);}template.value=presets[0].id;
 for(const group of [...new Set(library.map(a=>a.group))]){const optgroup=document.createElement('optgroup');optgroup.label=group;for(const art of library.filter(a=>a.group===group)){const option=document.createElement('option');option.value=art.id;option.textContent=art.name;optgroup.append(option);}$('artSelect').append(optgroup);}
 renderArtGallery();
 const palettes=[['苔绿纸','#f3eee2','#809185'],['雾蓝纸','#eff2ef','#7893a4'],['陶粉纸','#f6efea','#bc948c'],['麦金纸','#f7f1e2','#c0a363'],['浅灰纸','#efefeb','#8c9591']];
 for(const [name,base,accent]of palettes){const button=document.createElement('button');button.type='button';button.className='material-palette';button.title=name;button.setAttribute('aria-label',name);button.style.background=`linear-gradient(135deg,${base} 50%,${accent} 50%)`;button.onclick=()=>{$('materialBase').value=base;$('materialAccent').value=accent;previewMaterial();};$('materialPalettes').append(button);}
 previewMaterial();
 if(profile==='poster'){$('downloadUpload').hidden=true;$('preview').setAttribute('aria-label','图文首页图画布，可拖动可见元素');}
}
function installEvents(){
 // Finish the current IndexedDB transaction before an in-app page switch.
 for(const link of document.querySelectorAll('.editor-profiles a,.editor-back'))link.addEventListener('click',async event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  if(new URL(link.href).pathname===location.pathname){event.preventDefault();return;}
  if(!draftEnabled)return;
  event.preventDefault();link.setAttribute('aria-busy','true');
  const saved=await flushDraft();link.removeAttribute('aria-busy');
  if(saved)location.assign(link.href);else status('当前方案暂存未成功，请先点「保存方案」留存后再切换。');
 });
 for(const [id,target]of [['elementSwatches','element'],['paperSwatches','paper']])for(const color of commonColors){const button=document.createElement('button');button.type='button';button.className='color-swatch';button.dataset.color=color;button.style.backgroundColor=color;button.title=color;button.setAttribute('aria-label',(target==='paper'?'画布底色 ':'元素颜色 ')+color);button.onclick=()=>{if(target==='paper'){state.paper=color;$('paperColor').value=color;renderColorSwatches();redraw();}else changeLayer(e=>e.color=color);};$(id).append(button);}renderColorSwatches();
 $('alignLogoBottom').onchange=()=>{const e=current();if(!e||!isBrand(e))return;const y=textGeometry(state,e,mode).y;setBrandAlignment(e,mode,$('alignLogoBottom').checked);if(!isBrandAligned(e,mode))e.layout[mode].y=y;renderAlignmentControls(e);redraw();};
 $('closeExport').onclick=()=>$('exportDialog').close();
 $('exportDialog').addEventListener('close',()=>{exportGeneration++;});
 for(const id of ['title','subtitle','author']){
  $('quick-'+id).oninput=()=>{const e=quickLayer(id);if(!e)return;e.text=$('quick-'+id).value;e.enabled=Boolean(e.text.trim());selectedId=e.id;renderLayers();renderProperties();renderQuickFields();redraw();};
  $('quick-'+id+'-enabled').onchange=()=>{const e=quickLayer(id);if(!e)return;e.enabled=$('quick-'+id+'-enabled').checked;refresh();};
 }
 $('applyTemplate').onclick=async()=>{const key=$('templateSelect').value,preset=presets.find(p=>p.id===key);status('正在套用模板…');try{await loadState(createState(preset?.art||'ivory',key!=='blank',preset?.id));status('模板已套用，直接修改上方标题即可。');}catch(e){status('模板未载入：'+e.message);}};
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&draftTimer)void flushDraft();});
 window.addEventListener('pagehide',()=>{if(draftTimer)void flushDraft();});
 $('modeWide').onclick=()=>setMode('wide');$('modeSquare').onclick=()=>setMode('square');
 $('artSelect').onchange=()=>void selectArt($('artSelect').value);$('artCategory').onchange=renderArtGallery;
 $('posterFormat').onchange=()=>{model.changeFormat(state,$('posterFormat').value);refresh();status('竖版画幅已更换，方版排版保留。');};
 for(const id of ['materialStyle','materialBase','materialAccent','materialIntensity'])$(id).oninput=previewMaterial;
 $('shuffleMaterial').onclick=()=>{materialSeed=(Math.imul(materialSeed,1664525)+1013904223)>>>0||1;previewMaterial();};$('applyMaterial').onclick=applyMaterial;
 $('hideAll').onclick=()=>{state.elements.forEach(e=>e.enabled=false);refresh();status('所有文字、标志和短线已隐藏。');};
 $('showAll').onclick=()=>{model.showFilled(state);refresh();};
 $('showSample').onclick=()=>{const art=state.art==='custom'?'ivory':state.art;const fresh=createState(art,true);for(const key of ['art','customBackground','customLogo','customLabel','material','background','paper','format'])fresh[key]=clone(state[key]??null);fresh.style=state.style;state=fresh;selectedId='title';refresh();status('已套用排版示例；所有内容都可修改或关闭。');};
 $('elementEnabled').onchange=()=>{changeLayer(e=>e.enabled=$('elementEnabled').checked);};
 $('elementText').oninput=()=>changeLayer(e=>e.text=$('elementText').value);
 $('elementFont').onchange=()=>changeLayer(e=>e.font=$('elementFont').value);
 $('elementColor').oninput=()=>changeLayer(e=>e.color=$('elementColor').value);
 $('elementAlign').onchange=()=>changeLayer((e,l)=>l.align=$('elementAlign').value);
 numberInput('elementSize',(e,l,n)=>l.size=n,1,800);numberInput('elementOpacity',(e,l,n)=>e.opacity=n/100,0,100);
 numberInput('elementX',(e,l,n)=>l.x=n,-4000,4000);numberInput('elementY',(e,l,n)=>{setBrandAlignment(e,mode,false);l.y=n;},-4000,4000);
 numberInput('elementWidth',(e,l,n)=>l.width=n,20,1880);numberInput('elementLineHeight',(e,l,n)=>l.lineHeight=n,.8,3);
 $('addText').onclick=()=>{if(state.elements.length>=50){status('最多保留50个元素。');return;}const e={id:'text-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),name:'自定义文字',type:'text',text:'自定义文字',enabled:true,font:'cn',color:'#102923',opacity:1,layout:{wide:layout(120,330,65,700),square:layout(55,250,55,680)}};state.elements.push(e);selectedId=e.id;refresh();$('elementText').focus();$('elementText').select();};
 $('deleteElement').onclick=()=>{state.elements=state.elements.filter(e=>e.id!==selectedId);selectedId=state.elements.at(-1)?.id||null;refresh();};
 function reorder(direction){const i=state.elements.findIndex(e=>e.id===selectedId),j=i+direction;if(i<0||j<0||j>=state.elements.length)return;[state.elements[i],state.elements[j]]=[state.elements[j],state.elements[i]];refresh();}
 $('moveUp').onclick=()=>reorder(1);$('moveDown').onclick=()=>reorder(-1);
 $('paperColor').oninput=()=>{state.paper=$('paperColor').value;renderColorSwatches();redraw();};$('squareBgMode').onchange=()=>{state.background.square.mode=$('squareBgMode').value;redraw();};
 for(const [id,key,scale]of [['focusX','focusX',100],['focusY','focusY',100],['bgZoom','zoom',100]])$(id).oninput=()=>{state.background[mode][key]=Number($(id).value)/scale;redraw();};
 $('backgroundFile').onchange=()=>uploadImage($('backgroundFile'),'background');$('logoFile').onchange=()=>uploadImage($('logoFile'),'logo');
 $('downloadCurrent').onclick=()=>downloadCanvas(draw(state,mode).canvas,(mode==='square'?'方版':profile==='poster'?'竖版':'横版')+'-'+dimensionsFor(state)[mode].join('x'));
 $('downloadBackground').onclick=()=>downloadCanvas(draw(state,mode,{backgroundOnly:true}).canvas,'纯底图-'+dimensionsFor(state)[mode].join('x'));
 $('downloadUpload').onclick=()=>downloadCanvas(uploadSheet(state),'双裁切母图-1880x1600');
 $('saveDesign').onclick=()=>{exportGeneration++;showExport(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),filename('方案.json'));};
 $('loadDesign').onchange=async()=>{const input=$('loadDesign'),file=input.files[0];if(!file)return;try{if(file.size>60*1024*1024)throw new Error('方案文件超过60MB，请检查是否选错文件。');await loadState(JSON.parse(await file.text()));}catch(e){status('未载入：'+e.message);}finally{input.value='';}};
 const canvas=$('preview');const point=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};};
 canvas.onpointerdown=e=>{const p=point(e),hit=[...hitboxes].reverse().find(b=>p.x>=b.x-8&&p.x<=b.x+b.width+8&&p.y>=b.y-8&&p.y<=b.y+b.height+8);if(!hit){selectedId=null;refresh();return;}selectedId=hit.id;const element=current(),l=element.layout[mode];drag={pointer:e.pointerId,start:p,x:l.x,y:element.type==='text'?textGeometry(state,element,mode).y:l.y};canvas.setPointerCapture(e.pointerId);refresh();};
 canvas.onpointermove=e=>{if(!drag)return;const p=point(e),element=current(),l=element?.layout[mode];if(!l||p.x===drag.start.x&&p.y===drag.start.y)return;setBrandAlignment(element,mode,false);l.x=Math.max(-4000,Math.min(4000,Math.round(drag.x+p.x-drag.start.x)));l.y=Math.max(-4000,Math.min(4000,Math.round(drag.y+p.y-drag.start.y)));renderProperties();redraw();};
 const endDrag=e=>{if(drag&&canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);drag=null;};canvas.onpointerup=endDrag;canvas.onpointercancel=endDrag;
}
window.coverReady=(async()=>{
 configureStudio();
 const cn=new FontFace('CoverCN',`url(${assets.cn})`,{weight:'600'}),en=new FontFace('CoverEN',`url(${assets.en})`,{weight:'400'});
 await Promise.all([cn.load(),en.load()]);document.fonts.add(cn);document.fonts.add(en);
 await Promise.all(['logo','ivory'].map(ensureArt));
 refresh();const restored=await restoreDraft();installEvents();$('editorApp').inert=false;status(restored?'已恢复上次方案，可以继续编辑。':'选择模板，或直接输入标题；所有文字都可以单独隐藏。');
 window.coverAPI={createState,draw,uploadSheet,makeCanvas,loadState,validateState,getState:()=>clone(state),setMode,selectElement:id=>{selectedId=id;refresh();},getMode:()=>mode,flushDraft};return true;
})().catch(e=>{draftEnabled=false;draftMessage('未改动本机旧草稿。');status('加载失败：'+e.message+' 请刷新重试。');throw e;});
