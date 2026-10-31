import { CANVAS, PALETTES, BACKGROUNDS, createProject, validateProject, parseProject, serializeProject, changeBackground, withPalette, resetLayout, describeProject } from './model.mjs?v=e584159048f79e2b';
import { renderProject, hitTest, setGroupOffset, visibleCharacterCount } from './canvas.mjs?v=e584159048f79e2b';
import { cleanFilename, downloadBlob, zipFiles } from './downloads.mjs?v=e584159048f79e2b';

const $ = (id) => document.getElementById(id);
const canvas = $('moments-canvas');
const form = $('editor-form');
const embedded = new URLSearchParams(location.search).get('embedded') === '1';
document.body.classList.toggle('embedded', embedded);
const contentFields = { 'display-name':'displayName', 'account-id':'accountId', 'published-at':'publishedAt', 'avatar-text':'avatarText', title:'title', body:'body' };
const styleFields = { top:'top', side:'side', bottom:'bottom', 'title-size':'titleSize', 'body-size':'bodySize', 'title-gap':'titleGap', 'body-gap':'bodyGap', 'line-height':'lineHeight', 'paragraph-gap':'paragraphGap', 'title-color':'titleColor', 'body-color':'bodyColor', 'accent-color':'accentColor' };
const rangeBounds = Object.fromEntries(Object.keys(styleFields).filter((id) => $(id).type === 'range').map((id) => [id, [Number($(id).min), Number($(id).max)]]));
const imageCache = new Map();
let project = createProject();
let revision = 0;
let savedSignature = serializeProject(project);
let saveLabel = '示例';
let notesDirty = false;
let fileHandle = null;
let selected = null;
let drag = null;
let busy = false;
let lastRender = null;
let lastRenderedRevision = -1;
let paintToken = 0;
let projectLoadToken = 0;

function status(message, error = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
  reportHeight();
}
function dirty() {
  try { return serializeProject(project) !== savedSignature; } catch { return true; }
}
function hasUnsaved() { return dirty() || notesDirty; }
function syncSaveState() { $('save-state').textContent = dirty() ? '未保存' : saveLabel; }
function syncDisabled() {
  for (const control of form.querySelectorAll('input,textarea,select,button')) control.disabled = busy;
  $('show-safe-area').disabled = busy;
  $('download-png').disabled = busy || lastRenderedRevision !== revision || !lastRender?.ok;
  canvas.setAttribute('aria-disabled', String(busy));
}
function currentStyle() { return project.styles[project.backgroundId]; }
function syncOffsetFields() {
  const group = selected || $('selected-group').value;
  $('selected-group').value = group;
  const offset = currentStyle().offsets[group];
  $('offset-x').value = String(offset.x);
  $('offset-y').value = String(offset.y);
}
function syncControls({ content = false } = {}) {
  if (content) for (const [id,key] of Object.entries(contentFields)) $(id).value = project.content[key];
  for (const button of document.querySelectorAll('[data-background]')) button.setAttribute('aria-pressed', String(button.dataset.background === project.backgroundId));
  $('palette-field').hidden = project.backgroundId !== 'solid';
  $('solid-palette').value = project.solidPalette;
  const style = currentStyle();
  for (const [id,key] of Object.entries(styleFields)) {
    const control = $(id);
    if (rangeBounds[id]) {
      control.min = String(Math.min(rangeBounds[id][0], style[key]));
      control.max = String(Math.max(rangeBounds[id][1], style[key]));
    }
    control.value = String(style[key]);
    const output = document.querySelector(`[data-value-for="${id}"]`);
    if (output) output.textContent = String(style[key]);
  }
  const count = visibleCharacterCount(project.content.body);
  $('body-count').textContent = `${count}字 · 短版最多260字，超出画面会提示`;
  syncOffsetFields();
  syncSaveState();
  syncDisabled();
}
function loadImage(url) {
  if (!imageCache.has(url)) {
    imageCache.set(url, new Promise((resolve,reject) => {
      const image = new Image();
      const timer = setTimeout(() => { image.src=''; imageCache.delete(url); reject(new Error('纸画底图读取超时，当前工程未被替换。请检查网络后重试。')); }, 15000);
      image.decoding = 'async';
      image.onload = () => { clearTimeout(timer); resolve(image); };
      image.onerror = () => { clearTimeout(timer); imageCache.delete(url); reject(new Error('纸画底图未能加载，请检查页面资源后重试。')); };
      image.src = url;
    }));
  }
  return imageCache.get(url);
}
async function backgroundFor(snapshot) {
  const url = BACKGROUNDS[snapshot.backgroundId].image;
  return url ? loadImage(url) : null;
}
async function paint() {
  const token = ++paintToken, capturedRevision = revision, snapshot = project;
  $('download-png').disabled = true;
  let backgroundImage = null, loadError = '';
  try {
    await document.fonts?.ready;
    backgroundImage = await backgroundFor(snapshot);
  } catch (error) { loadError = error.message; }
  if (token !== paintToken || capturedRevision !== revision) return;
  try {
    lastRender = renderProject(canvas, snapshot, { backgroundImage, selected, safeArea: $('show-safe-area').checked });
    lastRenderedRevision = capturedRevision;
    const errors = [...new Set([...(lastRender.errors || []), ...(loadError ? [loadError] : [])])];
    if (loadError) lastRender.ok = false;
    $('layout-errors').hidden = errors.length === 0;
    $('layout-errors').textContent = errors.join(' ');
    document.body.dataset.ready = 'true';
    document.body.dataset.editorReady = 'true';
    if ($('status').textContent === '正在准备预览…') status('');
  } catch (error) {
    lastRender = null;
    lastRenderedRevision = capturedRevision;
    $('layout-errors').hidden = false;
    $('layout-errors').textContent = error.message || '当前内容暂时无法排版，文字仍保留在输入框中。';
    document.body.dataset.ready = 'true';
    document.body.dataset.editorReady = 'true';
  }
  syncDisabled();
  reportHeight();
}
function commit(next, { content = false } = {}) {
  project = next;
  revision++;
  status('');
  syncControls({ content });
  void paint();
}
function tryCommit(action, options) {
  if (busy) return;
  try { commit(action(), options); } catch (error) { status(error.message, true); }
}
function replaceProject(next, handle = null, label = '已载入') {
  project = validateProject(next);
  revision++;
  savedSignature = serializeProject(project);
  saveLabel = label;
  fileHandle = handle;
  selected = null;
  drag = null;
  $('feedback-notes').value = '';
  notesDirty = false;
  syncControls({ content: true });
  void paint();
}
async function importProject(value,handle=null,label='已载入') {
  const next=validateProject(structuredClone(value)),token=++projectLoadToken,capturedRevision=revision;
  await document.fonts?.ready;
  await backgroundFor(next);
  if(token!==projectLoadToken||capturedRevision!==revision)throw new Error('当前内容已变化，未替换工程，请重新载入。');
  replaceProject(next,handle,label);
  await paint();
}
function snapshotNow() { return { project: validateProject(project), revision }; }
function assertFresh(captured) {
  if (captured !== revision) throw new Error('内容已发生变化，请按当前工程重新导出。');
}
async function asPng(snapshot, requireValid = true) {
  await document.fonts?.ready;
  const backgroundImage = await backgroundFor(snapshot);
  const exportCanvas = document.createElement('canvas');
  const result = renderProject(exportCanvas, snapshot, { backgroundImage });
  if (requireValid && !result.ok) throw new Error(result.errors.join(' ') || '文字超出画面，请先调整版面。');
  const blob = await new Promise((resolve,reject) => exportCanvas.toBlob((value) => value ? resolve(value) : reject(new Error('PNG生成失败，请重试。')), 'image/png'));
  return { blob, result };
}
async function exportAction(action) {
  if (busy) return;
  busy = true;
  syncDisabled();
  try { await action(); }
  catch (error) {
    if (error?.name === 'AbortError') status('已取消操作，当前修改仍保留。');
    else status(error.message || '操作失败，当前修改仍保留。', true);
  } finally { busy = false; syncDisabled(); reportHeight(); }
}

for (const key of Object.keys(PALETTES)) {
  const option = document.createElement('option'); option.value = key; option.textContent = key;
  $('solid-palette').append(option);
}
for (const [id,key] of Object.entries(contentFields)) $(id).addEventListener('input', () => {
  if (busy) return;
  const next = structuredClone(project);
  next.content[key] = $(id).value;
  commit(next);
});
for (const [id,key] of Object.entries(styleFields)) $(id).addEventListener('input', () => {
  if (busy) return;
  const value = $(id).type === 'color' ? $(id).value : Number($(id).value);
  if (typeof value === 'number' && !Number.isFinite(value)) return;
  tryCommit(() => {
    const next = structuredClone(project); next.styles[next.backgroundId][key] = value;
    return validateProject(next);
  });
});
for (const button of document.querySelectorAll('[data-background]')) button.addEventListener('click', () => {
  tryCommit(() => changeBackground(project, button.dataset.background));
});
$('solid-palette').addEventListener('change', () => tryCommit(() => withPalette(project, $('solid-palette').value)));
$('selected-group').addEventListener('change', () => {
  selected = $('selected-group').value;
  syncOffsetFields();
  void paint();
});
for (const id of ['offset-x','offset-y']) $(id).addEventListener('input', () => {
  if (!$(id).value.trim()) return;
  const x = Number($('offset-x').value), y = Number($('offset-y').value);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  selected = $('selected-group').value;
  tryCommit(() => setGroupOffset(project, selected, { x, y }));
});
$('show-safe-area').addEventListener('change', () => void paint());
$('reset-layout').addEventListener('click', () => tryCommit(() => resetLayout(project)));
$('load-sample').addEventListener('click', () => {
  if (busy || (hasUnsaved() && !window.confirm('恢复示例会替换当前未保存的修改，是否继续？'))) return;
  replaceProject(createProject(), null, '示例');
  status('已恢复示例。');
});
$('clear-content').addEventListener('click', () => {
  if (busy || !window.confirm('清空当前文字？背景和版面参数会保留。')) return;
  const next = structuredClone(project); next.content = createProject({ sample:false }).content;
  commit(next, { content:true });
});
$('download-png').addEventListener('click', () => void exportAction(async () => {
  const snapshot = snapshotNow();
  status('正在生成PNG…');
  const { blob } = await asPng(snapshot.project);
  assertFresh(snapshot.revision);
  downloadBlob(blob, `${cleanFilename(snapshot.project.content.title)}.png`);
  status('PNG已生成，请在下载文件中查看。');
}));
$('save-project').addEventListener('click', () => void exportAction(async () => {
  const snapshot = snapshotNow(), json = serializeProject(snapshot.project);
  const suggestedName = `${cleanFilename(snapshot.project.content.title)}-工程.json`;
  let handle = fileHandle;
  if (!handle && typeof window.showSaveFilePicker === 'function') {
    try {
      handle = await window.showSaveFilePicker({ suggestedName, types:[{ description:'排版工程', accept:{ 'application/json':['.json'] } }] });
    } catch (error) {
      if (error?.name !== 'SecurityError' && error?.name !== 'NotSupportedError') throw error;
      handle = null;
    }
  }
  assertFresh(snapshot.revision);
  if (handle) {
    if (handle.queryPermission && await handle.queryPermission({ mode:'readwrite' }) !== 'granted') {
      const permission = handle.requestPermission ? await handle.requestPermission({ mode:'readwrite' }) : 'prompt';
      if (permission !== 'granted') {
        fileHandle = null;
        throw new Error('没有获得原文件的写入权限。再次点击“保存工程”可另选文件，当前修改仍保留。');
      }
    }
    assertFresh(snapshot.revision);
    const writable = await handle.createWritable();
    try { await writable.write(json); await writable.close(); }
    catch (error) { try { await writable.abort?.(); } catch {} throw error; }
    assertFresh(snapshot.revision);
    fileHandle = handle;
    savedSignature = json;
    saveLabel = '已保存';
    syncSaveState();
    status(`工程已保存到${handle.name || '所选文件'}，下次可载入继续编辑。`);
  } else {
    downloadBlob(new Blob([json], { type:'application/json;charset=utf-8' }), suggestedName);
    status('工程JSON已生成。请保留下载文件，下次载入继续；网页无法确认文件已落盘，当前修改仍标为未保存。');
  }
}));

async function acceptFile(file, handle = null) {
  if (!file || file.size > 500000) throw new Error('请选择500KB以内的排版工程JSON。');
  const next = parseProject(await file.text());
  if (hasUnsaved() && !window.confirm('载入会替换当前未保存的修改，是否继续？')) return;
  await importProject(next, handle);
  status(`已载入${file.name}，可以继续修改。`);
}
$('load-project').addEventListener('click', async () => {
  if (busy) return;
  if (typeof window.showOpenFilePicker === 'function') {
    let useInput = false;
    await exportAction(async () => {
      let handles;
      try { handles = await window.showOpenFilePicker({ multiple:false, types:[{ description:'排版工程', accept:{ 'application/json':['.json'] } }] }); }
      catch (error) {
        if (error?.name === 'SecurityError' || error?.name === 'NotSupportedError') { useInput = true; return; }
        throw error;
      }
      if (handles?.[0]) await acceptFile(await handles[0].getFile(), handles[0]);
    });
    if (useInput) $('project-file').click();
  } else $('project-file').click();
});
$('project-file').addEventListener('change', () => {
  const file = $('project-file').files?.[0];
  $('project-file').value = '';
  if (file) void exportAction(() => acceptFile(file));
});
$('feedback-notes').addEventListener('input', () => { if (!busy) notesDirty = Boolean($('feedback-notes').value); });
$('download-feedback').addEventListener('click', () => void exportAction(async () => {
  const snapshot = snapshotNow(), notes = $('feedback-notes').value.trim();
  const files = [{ name:'project.json', bytes:new TextEncoder().encode(serializeProject(snapshot.project)) }];
  status('正在整理反馈包…');
  let previewErrors = [];
  try {
    const { blob, result } = await asPng(snapshot.project, false);
    previewErrors = result.errors;
    files.push({ name:'preview.png', bytes:new Uint8Array(await blob.arrayBuffer()) });
  } catch (error) { previewErrors = [error.message]; }
  const backgroundUrl = BACKGROUNDS[snapshot.project.backgroundId].image;
  if (backgroundUrl) {
    try {
      const response = await fetch(backgroundUrl, { credentials:'same-origin' });
      if (!response.ok) throw new Error('背景资源不可读');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > 8 * 1024 * 1024) throw new Error('背景资源过大');
      files.push({ name:'background.png', bytes });
    } catch (error) { previewErrors.push(`未附背景：${error.message}`); }
  }
  const feedback = `${describeProject(snapshot.project)}\n\n## 希望AI调整\n\n${notes || '请结合当前工程和预览查看排版。'}\n\n## 当前检查\n\n${previewErrors.length ? `${previewErrors.join('\n')}\n\npreview.png仅供定位问题，不是可发布成品。` : '预览通过当前版面检查。'}\n\n此反馈包只下载到本机，不会自动发送到聊天。请保留project.json，审核后另存新版本，不直接覆盖母版。\n`;
  files.push({ name:'feedback.md', bytes:new TextEncoder().encode(feedback) });
  assertFresh(snapshot.revision);
  downloadBlob(new Blob([zipFiles(files)], { type:'application/zip' }), `${cleanFilename(snapshot.project.content.title)}-反馈包.zip`);
  notesDirty = false;
  status(previewErrors.length ? '反馈包已生成，内含版面检查说明；请下载后交给AI。' : '反馈包已生成，包含工程、预览和修改说明；请下载后交给AI。');
}));

function pointerPoint(event) {
  const box = canvas.getBoundingClientRect();
  return { x:(event.clientX - box.left) * CANVAS.width / box.width, y:(event.clientY - box.top) * CANVAS.height / box.height };
}
canvas.addEventListener('pointerdown', (event) => {
  if (busy || !lastRender || event.button !== 0) return;
  const point = pointerPoint(event), group = hitTest(lastRender, point.x, point.y);
  selected = group;
  if (group) {
    const offset = currentStyle().offsets[group];
    drag = { id:event.pointerId, start:point, original:{ ...offset }, group, moved:false };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('dragging');
    syncOffsetFields();
    canvas.focus({ preventScroll:true });
  }
  void paint();
});
canvas.addEventListener('pointermove', (event) => {
  if (busy || !drag || event.pointerId !== drag.id) return;
  const point = pointerPoint(event);
  const offset = { x:Math.round(drag.original.x + point.x - drag.start.x), y:Math.round(drag.original.y + point.y - drag.start.y) };
  drag.moved = true;
  tryCommit(() => setGroupOffset(project, drag.group, offset));
});
function endDrag(event) {
  if (!drag || event.pointerId !== drag.id) return;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  drag = null;
  canvas.classList.remove('dragging');
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('lostpointercapture', () => { drag = null; canvas.classList.remove('dragging'); });
canvas.addEventListener('keydown', (event) => {
  if (busy) return;
  if (event.key === 'Escape') { selected = null; void paint(); return; }
  const direction = { ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1] }[event.key];
  if (!direction) return;
  event.preventDefault();
  selected ||= $('selected-group').value;
  const previous = currentStyle().offsets[selected], step = event.shiftKey ? 10 : 1;
  tryCommit(() => setGroupOffset(project, selected, { x:previous.x + direction[0]*step, y:previous.y + direction[1]*step }));
});
window.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 's') { event.preventDefault(); if (!busy) $('save-project').click(); }
});
window.addEventListener('beforeunload', (event) => { if (hasUnsaved()) { event.preventDefault(); event.returnValue = ''; } });
form.addEventListener('submit', (event) => event.preventDefault());

let heightFrame = 0;
function reportHeight() {
  if (window.parent === window || !/^https?:$/.test(location.protocol)) return;
  cancelAnimationFrame(heightFrame);
  heightFrame = requestAnimationFrame(() => {
    const height = Math.ceil(document.querySelector('.editor-shell').getBoundingClientRect().height + 6);
    window.parent.postMessage({ type:'moments-editor-height', height:Math.max(720, Math.min(5000,height)) }, location.origin);
    window.parent.postMessage({ type:'layout-editor-height', kind:'moments', height:Math.max(720, Math.min(5000,height)) }, location.origin);
    window.parent.postMessage({ type:'layout-editor-state', kind:'moments' }, location.origin);
  });
}
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(reportHeight).observe(document.querySelector('.editor-shell'));
window.addEventListener('resize', reportHeight);
window.layoutEditor = {
  kind:'moments',
  getProject:() => validateProject(project),
  loadProject:async (value) => { await importProject(value); status('已载入工程。'); },
  exportImages:async () => {
    const snapshot=snapshotNow(), {blob}=await asPng(snapshot.project);
    assertFresh(snapshot.revision);
    return [{name:`${cleanFilename(snapshot.project.content.title)}.png`,blob}];
  },
  preview:async () => { const snapshot=snapshotNow(), {blob}=await asPng(snapshot.project,false); assertFresh(snapshot.revision); return blob; },
  getStatus:() => ({ok:lastRenderedRevision===revision&&Boolean(lastRender?.ok),errors:lastRender?.errors||[],hasChanges:hasUnsaved()}),
  setBusy:(value) => { busy=Boolean(value); syncDisabled(); },
  flush:async () => {},
  markSaved:(value) => {
    const signature=serializeProject(validateProject(structuredClone(value)));
    if(signature===serializeProject(project)){savedSignature=signature;saveLabel='已保存';syncSaveState();}
  },
};
syncControls({ content:true });
void paint();
