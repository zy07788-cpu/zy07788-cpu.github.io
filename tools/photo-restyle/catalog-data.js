window.PHOTO_RESTYLE_CATALOG = {
  "title": "照片转绘",
  "sourceRevision": "87bf9bba6e99ebc362155fe5d2ecdbe15f029ca0f33c67ae3ce4e165fc8baa05",
  "presets": [
    {
      "id": "oil-impasto",
      "name": "厚涂油画",
      "status": "available",
      "kind": "照片转画",
      "summary": "把照片转成有笔触与颜料颗粒的画面。",
      "ratio": "延续原图方向与比例",
      "preserve": "人物、动作、主要场景与光线关系",
      "transform": "绘画材质、背景细节与色彩层次",
      "text": "不额外加字",
      "command": "用 $photo-restyle，把这张照片转成「厚涂油画」，保留人物动作和原场景。",
      "previewKind": "material-reference",
      "previewLabel": "材质参考",
      "imageSrc": "assets/oil-impasto.png"
    },
    {
      "id": "photo-zine",
      "name": "实景拼贴海报",
      "status": "available",
      "kind": "照片做海报",
      "summary": "保留部分实景，让插画沿照片延伸。",
      "ratio": "默认竖版 3:5",
      "preserve": "真实摄影的主体与关键空间关系",
      "transform": "部分场景的插画概括、纸感和色彩结构",
      "text": "默认一小行英文，可另提中文或无字要求",
      "command": "用 $photo-restyle，把这张照片做成「实景拼贴海报」：保留部分真实照片，其余延伸成简化插画与留白，带自然撕纸边缘。",
      "previewKind": "synthetic-style-demo",
      "previewLabel": "AI 风景示意",
      "credit": "Gathered Scenes Zine v1.3 · Zeejay0",
      "imageSrc": "assets/photo-zine.png"
    },
    {
      "id": "future-03",
      "name": "新风格 03",
      "status": "planned",
      "summary": "留给下一张让你喜欢的参考图。"
    },
    {
      "id": "future-04",
      "name": "新风格 04",
      "status": "planned",
      "summary": "先试出味道，再把做法留在这里。"
    }
  ]
};
