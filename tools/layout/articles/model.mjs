export const PALETTES = Object.freeze({
  sage:Object.freeze({name:'深灰绿',paper:'#FBFAF6',ink:'#292B27',accent:'#4F675E',soft:'#E8ECE8',rule:'#CBD3CE'}),
  brown:Object.freeze({name:'茶褐',paper:'#FCFAF5',ink:'#2D2823',accent:'#805B48',soft:'#EEE7DE',rule:'#D9CDC2'}),
});
export const LIMITS = Object.freeze({text:100000,title:1000,images:20,imageData:8*1024*1024,totalImageData:28*1024*1024,pages:150});
export const DEFAULT_LAYOUTS = Object.freeze({
  A:Object.freeze({bodySize:48,lineHeight:1.9,paragraphGap:34,side:132,top:304,bottom:230,headingSize:76,align:'justify',footerStyle:'author-number'}),
  C:Object.freeze({bodySize:52,lineHeight:1.75,paragraphGap:26,side:64,top:190,bottom:156,headingSize:62,align:'justify',footerStyle:'author-number'}),
});
const clone=value=>structuredClone(value);
const fail=message=>{throw new Error(message);};
function plainObject(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const prototype=Object.getPrototypeOf(value);
  if(prototype===null||prototype===Object.prototype)return true;
  const constructor=Object.getOwnPropertyDescriptor(prototype,'constructor')?.value;
  return Object.getPrototypeOf(prototype)===null&&typeof constructor==='function'&&Function.prototype.toString.call(constructor)===Function.prototype.toString.call(Object);
}
const fields=(value,keys,label)=>{
  if(!plainObject(value))fail(`${label}格式无效。`);
  if(Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))fail(`${label}包含缺失或未知字段。`);
};
function inspect(value,depth=0){
  if(depth>9)fail('工程结构过深。');
  if(value&&typeof value==='object'){
    if(!Array.isArray(value)&&!plainObject(value))fail('工程对象格式无效。');
    for(const [key,descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))){
      if(['__proto__','prototype','constructor'].includes(key)||descriptor.get||descriptor.set)fail('工程包含不允许的对象字段。');
      inspect(descriptor.value,depth+1);
    }
  }else if(!['string','number','boolean','undefined'].includes(typeof value)&&value!==null)fail('工程包含不支持的数据。');
}
function text(value,max,label){if(typeof value!=='string'||value.length>max||value.includes('\0'))fail(`${label}必须是${max}字以内的文字。`);}
function number(value,min,max,label){if(!Number.isFinite(value)||value<min||value>max)fail(`${label}超出允许范围。`);}

export function createProject(){
  return {
    schemaVersion:1,templateId:'article-cards',templateVersion:1,layout:'A',mode:'illustrated',palette:'sage',format:'3:5',
    content:{title:'给判断，留一点空间',author:'记录者',account:'',headerText:'',body:'## 01 先把事实放在一起\n\n面对复杂的信息，我们总想尽快找到一个答案。但有时更有帮助的，是先分清事实、假设和自己的期待。\n\n**把依据留下来，把不确定说清楚。** 给新的发现留一点余地，也给自己一点思考的时间。\n\n同一份材料，可能有几种不同的解释。把判断写下来，注明它依赖的条件，下次回看时才知道什么发生了变化。\n\n不必急着让每一个问题都有结论。先记下已经知道的事，再列出还缺少的材料，下一步该做什么往往就清楚了。\n\n> 好的判断，不一定来得更快，却应该经得起回看。'},
    images:[],layouts:clone(DEFAULT_LAYOUTS),
  };
}
export function validateProject(value){
  inspect(value);
  fields(value,['schemaVersion','templateId','templateVersion','layout','mode','palette','format','content','images','layouts'],'工程');
  if(value.schemaVersion!==1||value.templateId!=='article-cards'||value.templateVersion!==1)fail('不支持的图文工程版本。');
  if(!['A','C'].includes(value.layout)||!['illustrated','text'].includes(value.mode)||!Object.hasOwn(PALETTES,value.palette)||!['3:5','3:4'].includes(value.format))fail('模板、配色或画幅无效。');
  fields(value.content,['title','body','author','account','headerText'],'文字');
  text(value.content.title,LIMITS.title,'标题');text(value.content.body,LIMITS.text,'正文');
  for(const key of ['author','account','headerText'])text(value.content[key],160,'署名与页眉');
  fields(value.layouts,['A','C'],'版面');
  for(const id of ['A','C']){
    const style=value.layouts[id];fields(style,Object.keys(DEFAULT_LAYOUTS[id]),'版面参数');
    for(const [key,min,max] of [['bodySize',28,96],['lineHeight',1.2,2.6],['paragraphGap',0,120],['side',24,600],['top',140,700],['bottom',120,700],['headingSize',36,140]])number(style[key],min,max,'版面参数');
    if(!['left','center','justify'].includes(style.align)||!['author-number','center-number'].includes(style.footerStyle))fail('对齐或页脚方式无效。');
  }
  if(!Array.isArray(value.images)||value.images.length>LIMITS.images)fail(`最多保存${LIMITS.images}张配图。`);
  let total=0;const ids=new Set();
  for(const image of value.images){
    fields(image,['id','data','name','width','height'],'图片');
    if(typeof image.id!=='string'||!/^image-[a-z0-9-]{1,55}$/.test(image.id)||ids.has(image.id))fail('图片编号无效或重复。');ids.add(image.id);
    text(image.name,160,'图片名称');
    if(typeof image.data!=='string'||image.data.length>LIMITS.imageData||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image.data))fail('图片必须是工程内的PNG、JPG或WebP，不能使用外链。');
    total+=image.data.length;number(image.width,1,20000,'图片宽度');number(image.height,1,20000,'图片高度');
    if(!Number.isInteger(image.width)||!Number.isInteger(image.height)||image.width*image.height>40000000)fail('图片尺寸过大或无效。');
  }
  if(total>LIMITS.totalImageData)fail('工程配图总量过大，请减少或压缩图片。');
  return clone(value);
}
export function serializeProject(project){return JSON.stringify(validateProject(project),null,2);}
export function parseProject(json){if(typeof json!=='string'||json.length>LIMITS.totalImageData+1500000)fail('工程文件过大。');let value;try{value=JSON.parse(json);}catch{fail('工程JSON无法读取。');}return validateProject(value);}
export function changeLayout(project,id){if(!['A','C'].includes(id))fail('请选择图文卡或手机阅读。');const next=validateProject(project);next.layout=id;return next;}

const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('zh',{granularity:'grapheme'}):null;
const graphemes=text=>segmenter?Array.from(segmenter.segment(text),item=>item.segment):Array.from(text);
export function parseInline(value,flags={bold:false,italic:false,underline:false}){
  const result=[];let cursor=0,plain='';
  const flush=()=>{for(const text of graphemes(plain))result.push({text,...flags});plain='';};
  while(cursor<value.length){
    const marker=['**','__','*'].find(item=>value.startsWith(item,cursor)&&value.indexOf(item,cursor+item.length)>cursor+item.length);
    if(marker){const close=value.indexOf(marker,cursor+marker.length);flush();const key=marker==='**'?'bold':marker==='__'?'underline':'italic';result.push(...parseInline(value.slice(cursor+marker.length,close),{...flags,[key]:true}));cursor=close+marker.length;}
    else{const point=value.codePointAt(cursor);const char=String.fromCodePoint(point);plain+=char;cursor+=char.length;}
  }
  flush();return result;
}
export function parseBlocks(body){
  const blocks=[];let lines=[],type='paragraph';
  const flush=()=>{if(lines.length){const value=lines.join('\n');blocks.push({type,chars:parseInline(value),text:value});lines=[];}};
  for(const line of body.replace(/\r\n?/g,'\n').split('\n')){
    if(!line.trim()){flush();type='paragraph';continue;}
    const heading=line.match(/^#{1,6}\s+(.+)$/),image=line.match(/^!\[([^\]]*)\]\((image-[a-z0-9-]+)\)\s*$/),quote=line.match(/^>\s?(.*)$/);
    if(heading){flush();blocks.push({type:'heading',chars:parseInline(heading[1]),text:heading[1]});type='paragraph';}
    else if(image){flush();blocks.push({type:'image',imageId:image[2],caption:image[1]});type='paragraph';}
    else if(quote){if(type!=='quote')flush();type='quote';lines.push(quote[1]);}
    else{if(type!=='paragraph')flush();type='paragraph';lines.push(line);}
  }
  flush();return blocks;
}
export function describeProject(project){
  const p=validateProject(project),style=p.layouts[p.layout];
  return `图文阅读工程\n模板：${p.layout==='C'?'C 手机阅读':'A 图文／长文卡'}\n正文模式：${p.layout==='C'||p.mode==='text'?'纯文字':'贴图'}\n配色：${PALETTES[p.palette].name}\n字号：${style.bodySize}\n行距：${style.lineHeight}\n左右留白：${style.side}\n标题：${p.content.title}\n配图：${p.images.length}张\n`;
}
