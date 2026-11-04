(() => {
  'use strict';
  const catalog = window.PHOTO_RESTYLE_CATALOG;
  const $ = id => document.getElementById(id);
  const dialog = $('preset-dialog');
  let current = null;
  let toastTimer;
  const node = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  function notify(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').classList.add('show');
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3200);
  }
  function selectManualText() {
    $('manual-command').focus();
    $('manual-command').select();
    $('manual-command').setSelectionRange(0, $('manual-command').value.length);
  }
  async function copyCommand(command) {
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(command); copied = true; } catch (_) {}
    }
    if (!copied) {
      // Keep fallback inside an open dialog when the browser makes the rest inert.
      const field = node('textarea');
      field.value = command;
      field.setAttribute('aria-label', '待复制口令');
      field.style.cssText = 'position:fixed;left:0;top:0;opacity:0;width:1px;height:1px';
      const active = document.activeElement;
      (dialog.open ? dialog : document.body).appendChild(field);
      field.focus();field.select();
      try { copied = document.execCommand('copy'); } catch (_) {}
      field.remove();
      if (active && active.focus) active.focus();
    }
    if (copied) {
      notify('口令已复制，到 Codex 附上照片即可。');
    } else {
      $('manual-command').value = command;
      $('manual-copy-dialog').showModal();
      selectManualText();
    }
    return copied;
  }
  function closePreset() { dialog.close(); }
  function openPreset(preset) {
    current = preset;
    $('dialog-title').textContent = preset.name;
    $('dialog-summary').textContent = preset.summary;
    $('dialog-kind').textContent = preset.kind;
    $('dialog-image').src = preset.imageSrc;
    $('dialog-image').alt = preset.name + ' · ' + preset.previewLabel;
    $('dialog-image-label').textContent = preset.previewLabel;
    $('dialog-command').value = preset.command;
    $('dialog-credit').textContent = preset.credit || '';
    $('dialog-credit').hidden = !preset.credit;
    $('dialog-facts').replaceChildren();
    for (const [label, value] of [['保留',preset.preserve],['改变',preset.transform],['比例',preset.ratio],['文字',preset.text]]) {
      $('dialog-facts').append(node('dt','',label),node('dd','',value));
    }
    dialog.showModal();
  }
  function addStyle(preset, index) {
    const article = node('article','style-card');
    article.dataset.presetId = preset.id;
    const media = node('div','card-media '+(preset.id==='photo-zine'?'zine-media':'oil-media'));
    const img = node('img');img.src=preset.imageSrc;img.alt=preset.name+' · '+preset.previewLabel;img.loading='eager';
    media.append(img,node('span','media-label',preset.previewLabel));
    const copy = node('div','card-copy');
    const heading = node('div','card-title-row');
    heading.append(node('h3','',preset.name),node('span','card-number','0'+(index+1)));
    const actions = node('div','card-actions');
    const copyButton = node('button','primary-button','复制口令');copyButton.type='button';copyButton.append(node('span','','↗'));copyButton.dataset.action='copy';
    copyButton.addEventListener('click',()=>copyCommand(preset.command));
    const detailsButton = node('button','details-button','看看这套预设');detailsButton.type='button';detailsButton.dataset.action='details';
    detailsButton.addEventListener('click',()=>openPreset(preset));
    actions.append(copyButton,detailsButton);
    copy.append(heading,node('p','card-summary',preset.summary),actions);
    article.append(media,copy);$('available-styles').append(article);
  }
  function addReserved(preset, index) {
    const article=node('article','reserved-card');article.dataset.presetId=preset.id;
    const body=node('div');body.append(node('h3','',preset.name),node('p','',preset.summary),node('span','reserved-label','参考图 / 小样待补'));
    article.append(node('span','reserved-number',String(index+3).padStart(2,'0')),body);
    $('reserved-styles').append(article);
  }
  const available = catalog.presets.filter(p=>p.status==='available');
  const reserved = catalog.presets.filter(p=>p.status==='planned');
  $('available-count').textContent = available.length+' 种画风';
  available.forEach(addStyle);reserved.forEach(addReserved);
  dialog.querySelector('.dialog-close').addEventListener('click',closePreset);
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closePreset();}});
  $('dialog-copy-button').addEventListener('click',()=>{if(current)copyCommand(current.command);});
  $('manual-copy-dialog').querySelector('.manual-close').addEventListener('click',()=>$('manual-copy-dialog').close());
  $('manual-select').addEventListener('click',selectManualText);
  $('collect-style-button').addEventListener('click',()=>copyCommand('用 $photo-restyle，把这张参考图收成一个新的画风预设。先确认待转绘照片并试一张，等我认可效果后再收录；更新预设时，一并检查照片转绘网页目录是否需要同步。'));
})();
