(function(){
  'use strict';
  const embedded=new URLSearchParams(location.search).get('embedded')==='1'||window.parent!==window;
  document.documentElement.classList.toggle('is-embedded',embedded);
  const stage=document.querySelector('.stage'),sidebar=document.querySelector('.sidebar');
  const quick=stage.querySelector('.quick-editor'),toolbar=stage.querySelector('.toolbar'),backgroundControls=stage.querySelector('details.panel');
  sidebar.prepend(toolbar);sidebar.prepend(quick);
  if(backgroundControls)document.querySelector('#background-library').after(backgroundControls);
  // The same native controls remain available, collected next to the text inputs.
  const property=document.querySelector('#propertyPanel'),details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');
  details.id=property.id;details.className=property.className;summary.append(property.querySelector('h2'));body.className='details-body';
  while(property.firstChild)body.append(property.firstChild);
  details.append(summary,body);property.replaceWith(details);
  const sample=document.querySelector('#showSample');if(sample)quick.querySelector('.actions').append(sample);
  let frame=0;
  function report(){
    if(window.parent===window||!/^https?:$/.test(location.protocol))return;
    cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      const height=Math.ceil(document.querySelector('#editorApp').getBoundingClientRect().height+6);
      window.parent.postMessage({type:'layout-editor-height',height:Math.max(360,Math.min(10000,height)),kind:window.EDITOR_PROFILE||'cover'},location.origin);
    });
  }
  function stateChanged(){
    report();if(window.parent!==window&&/^https?:$/.test(location.protocol))window.parent.postMessage({type:'layout-editor-state',kind:window.EDITOR_PROFILE||'cover'},location.origin);
  }
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(report).observe(document.querySelector('#editorApp'));
  window.addEventListener('resize',report);window.addEventListener('layout-editor-state',stateChanged);
  window.coverReady.then(()=>{
    const api=window.coverAPI;
    window.layoutEditor=Object.freeze({
      kind:window.EDITOR_PROFILE||'cover',
      getProject:()=>api.projectSnapshot(),
      loadProject:project=>api.loadProject(project),
      exportImages:()=>api.exportProjectImages(),
      preview:()=>api.previewProject(),
      getStatus:()=>api.editorStatus(),
      setBusy:value=>api.setBusy(value),
      flush:()=>api.flush(),
      markSaved:project=>api.markSaved(project),
    });
    document.body.dataset.editorReady='true';stateChanged();
  }).catch(error=>{
    const message=document.querySelector('#status');message.textContent='编辑器未就绪：'+error.message;message.classList.add('error');
    document.body.dataset.editorReady='false';report();
  });
})();
