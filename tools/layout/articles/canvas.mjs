import { PALETTES, LIMITS, validateProject, parseBlocks } from './model.mjs?v=e584159048f79e2b';

export const FONT='"Songti SC", "STSong", "SimSun", serif';
const SANS='-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
export function dimensionsFor(project){return project.layout==='C'?{width:1280,height:2133}:{width:1440,height:project.format==='3:4'?1920:2400};}
export function canvasMeasure(context){return(text,style)=>{context.font=`${style.italic?'italic ':''}${style.bold?600:400} ${style.size}px ${FONT}`;return context.measureText(text).width;};}
const widthOf=(chars,style,measure)=>chars.filter(c=>c.text!=='\n').reduce((sum,c,index)=>sum+measure(c.text,{...style,...c})+(index?style.letterSpacing:0),0);
export function wrapChars(chars,width,style,measure,indent=0){
  const lines=[];let line=[],start=0,used=0;
  const flush=(end,explicit=false)=>{lines.push({chars:line,start,end,width:used,indent:lines.length?0:indent,explicit});line=[];used=0;start=end;};
  for(let i=0;i<chars.length;i++){
    const char=chars[i];
    if(char.text==='\n'){flush(i+1,true);continue;}
    const gap=line.length?style.letterSpacing:0,advance=measure(char.text,{...style,...char})+gap,available=width-(lines.length?0:indent);
    if(line.length&&used+advance>available){
      const carry=line.length>1&&(/^[，。！？、；：）》」』】,.!?;:%]$/.test(char.text)||/^[（《「『【(]$/.test(line.at(-1).text))?line.pop():null;
      if(carry){used=widthOf(line,style,measure);flush(i-1);line.push(carry);used=measure(carry.text,{...style,...carry});}
      else flush(i);
    }
    line.push(char);used+=measure(char.text,{...style,...char})+(line.length>1?style.letterSpacing:0);
  }
  if(line.length||!lines.length||chars.at(-1)?.text==='\n')flush(chars.length);
  return lines;
}
function headingParts(block,isC){
  const match=isC?block.text.match(/^(\d{1,2})[.、\s　]+(.+)$/):null;
  if(!match)return{number:'',chars:block.chars};
  const prefixLength=Array.from(block.text.slice(0,block.text.indexOf(match[2]))).length;
  let consumed=0,index=0;while(index<block.chars.length&&consumed<prefixLength){consumed+=Array.from(block.chars[index].text).length;index++;}
  return{number:match[1].padStart(2,'0'),chars:block.chars.slice(index)};
}
export function layoutProject(input,measure){
  let project;try{project=validateProject(input);}catch(error){return{ok:false,errors:[error.message],warnings:[],pages:[]};}
  const dimensions=dimensionsFor(project),settings=project.layouts[project.layout],isC=project.layout==='C',errors=[],warnings=[];
  const width=dimensions.width-settings.side*2,bottom=dimensions.height-settings.bottom,capacity=bottom-settings.top;
  const bodyStyle={size:settings.bodySize,lineHeight:settings.lineHeight,letterSpacing:isC?1:2,bold:false,italic:false};
  const blocks=parseBlocks(project.content.body),pages=[];
  if(!blocks.length)errors.push('请先填写正文。');
  if(width<settings.bodySize*3||capacity<settings.bodySize*settings.lineHeight*2){errors.push('当前留白与字号无法容纳正文，请减小字号或留白。');return{ok:false,errors,warnings,pages,dimensions};}
  let current={fragments:[],hasHeading:false},y=settings.top,pending=0,halted=false;
  const flush=()=>{if(current.fragments.length)pages.push(current);current={fragments:[],hasHeading:false};y=settings.top;pending=0;if(pages.length>=LIMITS.pages){errors.push(`正文超过${LIMITS.pages}页，请减少内容或拆成独立工程。原文仍保留。`);halted=true;}};
  const place=(fragment,gapAfter)=>{const top=y+(current.fragments.length?pending:0);fragment.y=top;current.fragments.push(fragment);y=top+fragment.height;pending=gapAfter;};
  for(let blockIndex=0;blockIndex<blocks.length&&!halted;blockIndex++){
    const block=blocks[blockIndex];
    if(block.type==='image'){
      if(isC||project.mode==='text'){if(!warnings.some(x=>x.includes('图片')))warnings.push('纯文字正文暂不显示图片，图片和插入位置仍保存在工程中。切回A贴图即可显示。');continue;}
      const image=project.images.find(image=>image.id===block.imageId);
      if(!image){errors.push(`未找到配图${block.imageId}，请上传对应图片或移除这行图片标记。`);continue;}
      const frameHeight=Math.min(760,capacity-(block.caption?70:0)),scale=Math.min(width/image.width,frameHeight/image.height);
      const captionStyle={size:30,lineHeight:1.6,letterSpacing:0,bold:false,italic:false};
      const captionChars=Array.from(block.caption,text=>({text,bold:false,italic:false,underline:false}));
      const captionLines=block.caption?wrapChars(captionChars,width,captionStyle,measure):[];
      const height=frameHeight+(captionLines.length?22+captionLines.length*48:0);
      if(height>capacity){errors.push(`配图${image.name}的图注过长，请缩短图注。`);continue;}
      if(current.fragments.length&&y+pending+height>bottom)flush();if(halted)break;
      place({type:'image',imageId:image.id,x:settings.side,width,height,frameHeight,drawWidth:image.width*scale,drawHeight:image.height*scale,caption:block.caption,captionLines,captionStyle},46);
      continue;
    }
    if(block.type==='heading'){
      if(current.hasHeading||y-settings.top>capacity*.68)flush();if(halted)break;
      const parts=headingParts(block,isC),style={size:settings.headingSize,lineHeight:isC?1.28:1.22,letterSpacing:1,bold:false,italic:false};
      const column=parts.number?108:0,lines=wrapChars(parts.chars,width-column,style,measure),height=lines.length*style.size*style.lineHeight;
      const before=current.fragments.length?(isC?46:56):0,after=isC?46:52,minCopy=bodyStyle.size*bodyStyle.lineHeight;
      if(height+after+minCopy>capacity){errors.push('章节标题过长，当前字号无法与正文同页，请缩短章节标题或减小章节字号。');continue;}
      if(current.fragments.length&&y+pending+before+height+after+minCopy>bottom)flush();if(halted)break;
      if(current.fragments.length)pending+=before;
      place({type:'heading',chars:block.chars,lines,number:parts.number,column,x:settings.side,width,height,style},after);current.hasHeading=true;
      continue;
    }
    const quote=block.type==='quote',style=quote?{...bodyStyle,size:Math.round(settings.bodySize*(isC?48/52:50/48)),lineHeight:isC?1.65:1.75,letterSpacing:1}:bodyStyle;
    const inset=quote?(isC?34:42):0,vertical=quote?(isC?10:14):0,lineHeight=style.size*style.lineHeight;
    let remaining=block.chars.slice(),continued=false;
    while(remaining.length&&!halted){
      const indent=!quote&&!continued&&settings.align!=='center'?settings.bodySize*2:0;
      const lines=wrapChars(remaining,width-inset,style,measure,indent);
      let available=bottom-y-(current.fragments.length?pending:0)-vertical*2;
      let fits=Math.floor((available+.01)/lineHeight);
      if(fits<1){if(current.fragments.length){flush();continue;}errors.push('当前版面无法容纳一行正文。');halted=true;break;}
      let take=remaining.length,chosen=lines;
      if(lines.length>fits){
        take=lines[fits-1].end;
        let sentence=-1;for(let i=0;i<take;i++)if(/[。！？!?；;]/.test(remaining[i].text))sentence=i+1;
        if(sentence>=take*.55)take=sentence;
        if(take<1){errors.push('无法为当前文字找到有效分页位置。');halted=true;break;}
        chosen=wrapChars(remaining.slice(0,take),width-inset,style,measure,indent);
      }
      const chars=remaining.slice(0,take),height=chosen.length*lineHeight+vertical*2;
      place({type:block.type,chars,lines:chosen,style,x:settings.side+inset,width:width-inset,height,vertical,continued,align:quote?'left':settings.align,sourceBlock:blockIndex},quote?(isC?48:44):settings.paragraphGap);
      remaining=remaining.slice(take);continued=true;
      if(remaining.length)flush();
    }
  }
  if(current.fragments.length&&!halted)pages.push(current);
  for(const page of pages){
    const last=page.fragments.at(-1);if(last?.type==='heading')errors.push('章节标题后还需要正文，请补充内容。');
    for(const fragment of page.fragments)if(fragment.y+fragment.height>bottom+1)errors.push('当前正文超出版心，请调整参数。');
  }
  return{ok:errors.length===0,pages,errors:[...new Set(errors)],warnings,dimensions,settings};
}
function drawLines(context,fragment,color,soft){
  const {style}=fragment,lineHeight=style.size*style.lineHeight;
  for(const [row,line] of fragment.lines.entries()){
    const available=fragment.width-line.indent,justify=fragment.align==='justify'&&!line.explicit&&row<fragment.lines.length-1&&line.chars.length>1;
    const extra=justify?Math.max(0,(available-line.width)/(line.chars.length-1)):0;
    let x=fragment.x+line.indent;
    if(fragment.align==='center')x=fragment.x+(fragment.width-line.width)/2;
    const y=fragment.y+(fragment.vertical||0)+row*lineHeight+(lineHeight-style.size)/2;
    for(const [index,char] of line.chars.entries()){
      context.font=`${char.italic?'italic ':''}${char.bold?600:400} ${style.size}px ${FONT}`;
      const width=context.measureText(char.text).width;
      if(char.bold&&char.underline){context.fillStyle=soft;context.fillRect(x,y+style.size*.79,width,style.size*.22);}
      context.fillStyle=color;context.fillText(char.text,x,y);
      if(char.underline){context.fillRect(x,y+style.size+6,width,2);}
      x+=width+style.letterSpacing+(index<line.chars.length-1?extra:0);
    }
  }
}
function label(context,text,x,y,width,size,color,align='left'){
  context.font=`400 ${size}px ${SANS}`;context.fillStyle=color;context.textAlign=align;
  let output=text;while(output&&context.measureText(output).width>width)output=output.slice(0,-1);if(output!==text&&output.length>1)output=output.slice(0,-1)+'…';context.fillText(output,x,y);context.textAlign='left';
}
export function renderPage(canvas,project,layout,index=0,images=new Map()){
  const {width,height}=dimensionsFor(project),palette=PALETTES[project.palette],settings=project.layouts[project.layout],isC=project.layout==='C';
  canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');if(!context)throw new Error('当前浏览器无法绘制图片。');
  context.fillStyle=palette.paper;context.fillRect(0,0,width,height);context.textBaseline='top';
  const side=settings.side,headerY=isC?72:124,headerHeight=isC?52:58;
  label(context,project.content.headerText||project.content.title||project.content.account,side,headerY+8,width-side*2,isC?28:36,palette.accent);
  context.fillStyle=palette.rule;context.fillRect(side,headerY+headerHeight,width-side*2,2);
  const page=layout.pages[index];
  for(const fragment of page?.fragments||[]){
    if(fragment.type==='image'){
      context.fillStyle=palette.soft;context.fillRect(fragment.x,fragment.y,fragment.width,fragment.frameHeight);
      const image=images instanceof Map?images.get(fragment.imageId):images[fragment.imageId];
      if(image)context.drawImage(image,fragment.x+(fragment.width-fragment.drawWidth)/2,fragment.y+(fragment.frameHeight-fragment.drawHeight)/2,fragment.drawWidth,fragment.drawHeight);
      if(fragment.captionLines.length)drawLines(context,{x:fragment.x,y:fragment.y+fragment.frameHeight+22,width:fragment.width,lines:fragment.captionLines,style:fragment.captionStyle,align:'left'},palette.accent,palette.soft);
    }else if(fragment.type==='heading'){
      if(fragment.number)label(context,fragment.number,fragment.x,fragment.y+4,82,Math.round(fragment.style.size*56/62),palette.accent);
      drawLines(context,{...fragment,x:fragment.x+fragment.column,width:fragment.width-fragment.column,align:'left'},palette.accent,palette.soft);
    }else{
      if(fragment.type==='quote'){context.fillStyle=palette.accent;context.fillRect(side,fragment.y,isC?5:6,fragment.height);}
      drawLines(context,fragment,fragment.type==='quote'?palette.accent:palette.ink,palette.soft);
    }
  }
  const footerY=height-(isC?54:112)-(isC?44:52)+9;
  if(settings.footerStyle==='center-number')label(context,String(index+1),width/2,footerY,width-side*2,isC?27:32,palette.accent,'center');
  else{label(context,[project.content.account,project.content.author].filter(Boolean).join(' · '),side,footerY,width-side*2-100,isC?27:32,palette.accent);label(context,String(index+1).padStart(2,'0'),width-side,footerY,100,isC?27:32,palette.accent,'right');}
  return canvas;
}
