(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CoverModel=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const hex=/^#[a-fA-F0-9]{6}$/;
  const validDataImage=value=>typeof value==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
  const layout=(x,y,size,width=700,lineHeight=1.2)=>({x,y,size,width,lineHeight,align:'left'});
  function dimensionsFor(profile,state={}){
    return profile==='poster'?{wide:[1440,state.format==='3:5'?2400:1920],square:[1080,1080]}:{wide:[1880,800],square:[800,800]};
  }
  function createState(profile,library,presets,art='ivory',sample=false,presetId){
    const p=presets.find(p=>p.id===presetId)||presets.find(p=>p.art===art)||presets[0];
    const a=library.find(a=>a.id===art)||library[0];
    const poster=profile==='poster',tea=p.brand==='tea',company=p.brand==='xunpu';
    const ink=p.style==='immersive'?'#fffaf0':a.ink,accent=p.style==='immersive'?'#fffaf0':a.accent;
    const text=(id,name,content,font,color,wide,square)=>({id,name,type:'text',text:content||'',font,color,opacity:1,enabled:sample&&Boolean(content),layout:{wide,square}});
    const elements=[
      {id:'logo',name:'标志',type:'logo',enabled:sample&&company,opacity:1,color:ink,layout:{wide:layout(104,poster?104:80,poster?62:43),square:layout(54,42,34)}},
      text('brandCN','品牌中文',company?'寻璞':tea?'茶叶的小喇叭':'','cn',ink,layout(company?(poster?188:161):104,poster?104:78,poster?43:32,500),layout(company?102:54,44,25,400)),
      text('brandEN','品牌英文',company?'XUNPU':'','en',ink,layout(poster?330:259,poster?104:78,poster?38:29,280),layout(179,44,23,220)),
      text('column','栏目',sample?p.column:'','sans',accent,layout(108,poster?240:153,poster?38:29,1100),layout(56,120,26,950)),
      text('title','标题',sample?p.title:'','cn',ink,layout(100,poster?390:259,poster?134:116,poster?1210:900,1.25),layout(49,183,profile==='poster'?108:87,profile==='poster'?970:690,1.2)),
      text('subtitle','副标题',sample?p.subtitle:'','sans',ink,layout(108,poster?834:595,poster?44:33,poster?1160:940,1.65),layout(54,profile==='poster'?508:441,profile==='poster'?34:28,profile==='poster'?950:690,1.5)),
      text('author','作者','','sans',ink,layout(108,poster?1780:741,poster?34:25,1100),layout(54,profile==='poster'?990:742,25,950)),
      text('english','英文 / 附加文字',sample?p.english:'','en',accent,layout(108,poster?1700:674,poster?36:30,1000),layout(54,profile==='poster'?940:692,26,950)),
      text('account','账号 / 署名',company?'涅槃之外':'','sans',ink,layout(poster?1030:752,poster?110:677,poster?30:25,280),layout(profile==='poster'?800:570,49,23,220)),
      {id:'rule',name:'短线',type:'rule',enabled:sample&&Boolean(p.column),opacity:1,color:accent,layout:{wide:layout(108,poster?320:219,4,72),square:layout(56,162,3,42)}}
    ];
    for(const e of elements)if(['brandCN','brandEN'].includes(e.id))e.alignLogoBottom={wide:true,square:true};
    const state={schemaVersion:3,documentType:profile,format:p.format||'3:4',templateId:p.id,art,customBackground:null,customLogo:null,customLabel:null,material:null,paper:a.paper,style:p.style||'full',background:{wide:{focusX:.5,focusY:.7,zoom:1},square:{focusX:.5,focusY:.6,zoom:1,mode:'cover'}},elements};
    if(p.style==='legacy'&&!poster){
      const positions={column:[108,195,30,680],title:[100,296,124,790],subtitle:[108,595,37,780],english:[108,674,30,600]};
      for(const e of elements)if(positions[e.id])e.layout.wide=layout(...positions[e.id],e.id==='title'?1.22:1.2);
      state.background.square={focusX:1,focusY:.35,zoom:1,mode:'editorial'};
      state.elements.find(e=>e.id==='title').layout.square=layout(49,165,88,690,1.15);
      state.elements.find(e=>e.id==='rule').layout.wide=layout(108,255,4,52);
      state.elements.find(e=>e.id==='rule').layout.square=layout(56,148,3,42);
    }
    if(p.style==='immersive'){
      elements.forEach(e=>e.enabled=sample&&['title','subtitle'].includes(e.id));
      elements.find(e=>e.id==='title').layout.wide=layout(104,450,134,1210,1.3);
      elements.find(e=>e.id==='subtitle').layout.wide=layout(110,870,46,1160,1.6);
    }
    return state;
  }
  function validateState(input,profile,library){
    const allowed=library.map(a=>a.id).concat('custom');
    if(!input||![2,3].includes(input.schemaVersion)||!allowed.includes(input.art)||!Array.isArray(input.elements)||input.elements.length>50)throw new Error('这不是本编辑器保存的有效方案。');
    if((input.documentType||(input.schemaVersion===2?'cover':null))!==profile)throw new Error(profile==='poster'?'这是公众号封面方案，请在公众号编辑器中载入。':'这是图文首页图方案，请在图文编辑器中载入。');
    const s=clone(input),num=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
    if(s.schemaVersion===2){s.schemaVersion=3;s.documentType='cover';s.style='legacy';s.format='3:4';}
    if(!['paper','full','fade','frame','immersive','legacy'].includes(s.style)||!['3:4','3:5'].includes(s.format)||!hex.test(s.paper))throw new Error('画布参数无效。');
    for(const key of ['customBackground','customLogo'])if(s[key]!==null&&s[key]!==undefined&&!validDataImage(s[key]))throw new Error('方案图片无效。');
    if(s.art==='custom'&&!s.customBackground)throw new Error('方案缺少自定义底图。');
    if(s.customLabel!==undefined&&s.customLabel!==null&&(typeof s.customLabel!=='string'||s.customLabel.length>100))throw new Error('底图名称无效。');
    if(s.material!==undefined&&s.material!==null){const m=s.material;if(!m||!['paper','canvas','wash','cutpaper'].includes(m.style)||!hex.test(m.base)||!hex.test(m.accent)||!num(m.seed,1,4294967295)||!Number.isInteger(m.seed)||!num(m.intensity,0,100))throw new Error('材质参数无效。');}
    for(const aspect of ['wide','square']){const v=s.background?.[aspect];if(!v||!num(v.focusX,0,1)||!num(v.focusY,0,1)||!num(v.zoom,1,2.4))throw new Error('底图位置参数无效。');}
    if(!['editorial','cover'].includes(s.background.square.mode))throw new Error('方图布局无效。');
    const ids=new Set();
    for(const e of s.elements){
      if(typeof e.id!=='string'||e.id.length>100||ids.has(e.id)||typeof e.name!=='string'||e.name.length>100||!['text','logo','rule'].includes(e.type)||typeof e.enabled!=='boolean'||!num(e.opacity,0,1)||!hex.test(e.color))throw new Error('元素参数无效。');ids.add(e.id);
      if(e.type==='text'&&(typeof e.text!=='string'||e.text.length>2000||!['cn','en','sans'].includes(e.font)))throw new Error('文字参数无效。');
      if(['brandCN','brandEN'].includes(e.id)){if(e.alignLogoBottom!==undefined&&(!e.alignLogoBottom||typeof e.alignLogoBottom!=='object'||Array.isArray(e.alignLogoBottom)||['wide','square'].some(aspect=>e.alignLogoBottom[aspect]!==undefined&&typeof e.alignLogoBottom[aspect]!=='boolean')))throw new Error('品牌对齐参数无效。');e.alignLogoBottom={wide:e.alignLogoBottom?.wide!==false,square:e.alignLogoBottom?.square!==false};}
      for(const aspect of ['wide','square']){const l=e.layout?.[aspect];if(!l||!num(l.x,-4000,4000)||!num(l.y,-4000,4000)||!num(l.size,1,800)||!num(l.width,20,2400)||!num(l.lineHeight,.8,3)||!['left','center','right'].includes(l.align))throw new Error('元素排版参数无效。');}
    }
    return s;
  }
  function changeFormat(state,format){
    if(state.documentType!=='poster'||!['3:4','3:5'].includes(format))throw new Error('图文画幅无效。');
    const before=dimensionsFor('poster',state).wide[1];
    state.format=format;const factor=dimensionsFor('poster',state).wide[1]/before;
    for(const e of state.elements)e.layout.wide.y=Math.max(-4000,Math.min(4000,Math.round(e.layout.wide.y*factor)));
    return state;
  }
  function showFilled(state){
    const namedCompany=state.elements.some(e=>e.id==='brandCN'&&e.type==='text'&&e.text.trim()==='寻璞');
    for(const e of state.elements)e.enabled=e.type==='text'?Boolean(e.text.trim()):e.type==='logo'?Boolean(e.enabled||state.customLogo||namedCompany):true;
    return state;
  }
  return Object.freeze({createState,validateState,dimensionsFor,changeFormat,showFilled,validDataImage});
});
