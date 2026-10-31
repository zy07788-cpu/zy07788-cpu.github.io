const kinds=new Set(['article','moments','cover','poster']);
export const MAX_PROJECT_BYTES=60*1024*1024;

function safeTree(value){
  const visited=new Set();let count=0;
  function inspect(node,depth){
    if(node===null||typeof node!=='object')return;
    if(depth>24||++count>200000||visited.has(node))throw Error('工程结构过深或存在循环。');
    const prototype=Object.getPrototypeOf(node);
    if(prototype!==Object.prototype&&prototype!==Array.prototype&&prototype!==null)throw Error('工程字段类型无效。');
    visited.add(node);
    for(const [key,descriptor]of Object.entries(Object.getOwnPropertyDescriptors(node))){
      if(['__proto__','prototype','constructor'].includes(key)||descriptor.get||descriptor.set)throw Error('工程包含不允许的字段。');
      inspect(descriptor.value,depth+1);
    }
    visited.delete(node);
  }
  inspect(value,0);
}
function object(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
export function wrapProject(editor,project){
  if(!kinds.has(editor)||!object(project))throw Error('无法识别这份排版工程。');
  safeTree(project);
  return {schemaVersion:1,application:'xunpu-layout-studio',editor,project:structuredClone(project)};
}
export function readProject(text){
  if(typeof text!=='string'||text.length>MAX_PROJECT_BYTES)throw Error('请选择60MB以内的排版工程JSON。');
  let input;try{input=JSON.parse(text);}catch{throw Error('这不是有效的工程JSON，请检查文件。');}
  if(!object(input))throw Error('无法识别这份排版工程。');
  safeTree(input);
  if(Object.hasOwn(input,'application')){
    if(input.application!=='xunpu-layout-studio'||input.schemaVersion!==1||!kinds.has(input.editor)||!object(input.project)||Object.keys(input).sort().join(',')!=='application,editor,project,schemaVersion')throw Error('工程版本或类型暂不支持。');
    return wrapProject(input.editor,input.project);
  }
  let editor;
  if(input.schemaVersion===1&&(input.documentType==='article'||input.templateId==='article-cards'))editor='article';
  else if(input.schemaVersion===1&&input.templateId==='xiaohongshu.social-card-b')editor='moments';
  else if([2,3].includes(input.schemaVersion)&&['cover','poster'].includes(input.documentType))editor=input.documentType;
  else if(input.schemaVersion===2&&!input.documentType&&Array.isArray(input.elements))editor='cover';
  else throw Error('无法识别工程类型或版本，请选择本工具保存的JSON。');
  return wrapProject(editor,input);
}
export function projectTitle(editor,project){
  if(editor==='article'||editor==='moments')return project.content?.title||project.title||'未命名排版';
  return project.elements?.find(element=>element.id==='title'&&element.type!=='logo')?.text||'未命名封面';
}
