/* Public artwork only. Resource paths work for both /cover/ and /poster/. */
window.ART_LIBRARY = [
  {id:'ivory', name:'米白棉纸', group:'纸张', file:'paper-ivory.png', paper:'#f5f0e5', ink:'#3f5149', accent:'#7b8a6a'},
  {id:'sage', name:'苔绿丘岸', group:'油画', file:'oil-sage.png', paper:'#f5f0e3', ink:'#3d5044', accent:'#7d8b68'},
  {id:'blue', name:'雾蓝海岸', group:'油画', file:'oil-blue.png', paper:'#f1f1e9', ink:'#3e5c6a', accent:'#6f91a1'},
  {id:'moss', name:'苔绿厚涂', group:'油画', file:'paint-thesis.png', shared:true, paper:'#f1f0e3', ink:'#3e5035', accent:'#7f8968'},
  {id:'coast', name:'海岸花野', group:'油画', file:'paint-duck.png', shared:true, paper:'#f0f1e9', ink:'#3b5b70', accent:'#8099b2'},
  {id:'rose', name:'陶粉花笺', group:'油画', file:'paint-drawer.png', shared:true, paper:'#f5eee5', ink:'#654f48', accent:'#bd9688'},
  {id:'ochre', name:'麦金画布', group:'油画', file:'paint-cover.png', shared:true, paper:'#f5f0e3', ink:'#655934', accent:'#bda668'},
  {id:'personal', name:'纸艺喇叭', group:'纸艺', file:'personal.png', paper:'#f8f7f3', ink:'#315c8a', accent:'#c94f3d'},
  {id:'news', name:'寻璞 · 层山', group:'寻璞', file:'news.png', paper:'#f8f7f3', ink:'#102923', accent:'#47665b'},
  {id:'risk', name:'寻璞 · 璞石', group:'寻璞', file:'risk.png', paper:'#f8f7f3', ink:'#102923', accent:'#874b2c'}
];
window.STUDIO_PRESETS = {
  cover:[
    {id:'paper', name:'留白纸笺', art:'ivory', style:'paper', title:'把日常\n写成故事', subtitle:'留一些时间，给值得记住的事。', column:'生活随记'},
    {id:'sage', name:'苔绿油画', art:'sage', style:'full', title:'慢一点\n也没关系', subtitle:'给自己一点留白。', column:''},
    {id:'blue', name:'雾蓝海岸', art:'blue', style:'full', title:'让想法\n有处安放', subtitle:'记录、分享，也继续尝试。', column:''},
    {id:'rose', name:'花笺拼贴', art:'rose', style:'fade', title:'记录一点\n温柔的事', subtitle:'把普通的一天，好好收起来。', column:''},
    {id:'personal', name:'纸艺 · 小喇叭', art:'personal', style:'legacy', brand:'tea', title:'认真生活\n也认真发声', english:'Notes on Life', column:'随笔'},
    {id:'news', name:'寻璞 · 讯息', art:'news', style:'legacy', brand:'xunpu', title:'这一周\n发生了什么', english:'Dispatch', column:'讯息'},
    {id:'risk', name:'寻璞 · 风险故事', art:'risk', style:'legacy', brand:'xunpu', title:'风险如何\n一步步发生', english:'Risk Stories', column:'风险故事'}
  ],
  poster:[
    {id:'D1', name:'D1 · 上图下题', art:'sage', style:'d1', format:'3:5', title:'让日常\n多一点留白', subtitle:'', column:'排版样例'},
    {id:'D2', name:'D2 · 全幅影像', art:'coast', style:'d2', format:'3:5', title:'把眼前的风景\n慢慢收进日常', subtitle:'记录，也给新的发现留一点余地。', column:''},
    {id:'paper-note', name:'纸张札记', art:'ivory', style:'paper', title:'把日常\n写成故事', subtitle:'留一些时间，给值得记住的事。', column:'生活随记'},
    {id:'oil-note', name:'油画随记', art:'blue', style:'full', title:'让生活\n慢慢展开', subtitle:'记录发生过的事，也留住当时的心情。', column:''},
    {id:'image-frame', name:'标准图框', art:'sage', style:'frame', title:'看见风景\n也看见自己', subtitle:'在路上，给自己一点时间。', column:'旅途笔记'},
    {id:'full-image', name:'全幅影像', art:'coast', style:'immersive', format:'3:5', title:'留一点时间\n给自己', subtitle:'慢下来，看看生活本来的样子。', column:''},
    {id:'rose-note', name:'陶粉花笺', art:'rose', style:'fade', title:'把普通的一天\n好好收起来', subtitle:'小事也值得被记得。', column:''},
    {id:'xunpu-poster', name:'寻璞 · 行业观察', art:'risk', style:'frame', brand:'xunpu', title:'看见问题\n也看见变化', subtitle:'把一件事，慢慢讲清楚。', column:'行业观察'}
  ]
};
window.ASSETS = {
  cn:'../cover/fonts/SourceHanSerifCN-SemiBold.woff2',
  en:'../cover/fonts/SourceSerif4-Regular.woff2',
  logo:'../cover/assets/xunpu-mother-symbol.svg',
  ...Object.fromEntries(window.ART_LIBRARY.map(art=>[art.id,'../cover/assets/'+art.file]))
};
