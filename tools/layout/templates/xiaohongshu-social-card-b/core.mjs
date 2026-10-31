// Bundled visual core from the approved B renderer (2026-09-23).
// Node CLI and personal dependency resolution are intentionally excluded.
export const SOCIAL_CARD_B_LAYOUTS = Object.freeze({
  full: Object.freeze({
    name: "全文阅读版",
    width: 1440,
    height: 2400,
    ratio: "3:5",
    maxPages: 2
  }),
  moments: Object.freeze({
    name: "朋友圈短版",
    width: 1440,
    height: 1920,
    ratio: "3:4",
    maxPages: 1
  })
});

export const SOCIAL_CARD_B_PALETTES = Object.freeze({
  "墨绿黑·旧金棕": Object.freeze({
    background: "#202923",
    body: "#ECE8DC",
    title: "#D8C29F",
    accent: "#B58E63",
    metadata: "#9BA29B"
  }),
  "雾灰墨蓝": Object.freeze({
    background: "#EEF0ED",
    body: "#272B2B",
    title: "#274755",
    accent: "#4F7180",
    underline: "#AD7447",
    metadata: "#788082"
  }),
  "象牙松墨": Object.freeze({
    background: "#F6F1E7",
    body: "#292B27",
    title: "#214737",
    accent: "#254B3B",
    underline: "#AD7049",
    metadata: "#7D7E77"
  }),
  "亚麻栗棕": Object.freeze({
    background: "#F2EBE0",
    body: "#2D2925",
    title: "#743B2E",
    accent: "#7B4334",
    underline: "#A65C43",
    metadata: "#7D7E77"
  })
});

function stripHtml(value = "") {
  return String(value).replace(/<[^>]*>/g, "");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeBody(body) {
  if (!Array.isArray(body)) return [];
  return body.map(item => typeof item === "string" ? { html: escapeHtml(item) } : item);
}

export function countSocialBodyChars(body) {
  return normalizeBody(body).reduce((count, paragraph) => (
    count + [...stripHtml(paragraph.html ?? "").replace(/\s+/g, "")].length
  ), 0);
}

export function validateSocialCardFixture(fixture) {
  const layout = SOCIAL_CARD_B_LAYOUTS[fixture.layout];
  if (!layout) throw new Error(`未知模板B画布版本：${fixture.layout}`);
  if (!SOCIAL_CARD_B_PALETTES[fixture.palette]) throw new Error(`未知模板B配色：${fixture.palette}`);
  if (!fixture.identity?.displayName || !fixture.identity?.accountId) throw new Error("缺少模板B身份信息");
  if (!fixture.publishedAt) throw new Error("缺少发布时间");
  const mediaMode = fixture.media?.mode ?? "none";
  if (!["none", "portrait"].includes(mediaMode)) throw new Error(`未知模板B图片模式：${mediaMode}`);
  if (mediaMode === "portrait") {
    if (fixture.layout !== "moments") throw new Error("竖图模式只用于朋友圈短版");
    if (!fixture.media?.url) throw new Error("竖图模式缺少图片");
    if (fixture.titleLines?.length) throw new Error("竖图模式不使用标题");
  } else {
    if (!Array.isArray(fixture.titleLines) || fixture.titleLines.length < 1) throw new Error("缺少人工确认的标题分行");
    if (fixture.layout === "moments" && fixture.titleLines.length > 2) throw new Error("朋友圈短版标题最多两行");
  }
  const bodyChars = countSocialBodyChars(fixture.body);
  if (!bodyChars) throw new Error("缺少正文");
  if (fixture.layout === "moments" && bodyChars > 260) throw new Error(`朋友圈短版正文为${bodyChars}字，超过260字`);
  return { layout, bodyChars, mediaMode };
}

export function validatePortraitImageMetrics(metrics, mediaMode) {
  if (mediaMode !== "portrait") return;
  if (!metrics?.loaded) throw new Error("竖图模式图片加载失败");
  if (metrics.naturalHeight <= metrics.naturalWidth) throw new Error("竖图模式提供的图片不是竖图");
  if (metrics.renderedWidth !== 800 || metrics.renderedHeight !== 1200) {
    throw new Error("竖图模式图片显示区不是800×1200");
  }
}

function renderAvatar(identity) {
  if (identity.avatarUrl) {
    return `<img class="avatar" src="${escapeHtml(identity.avatarUrl)}" alt="${escapeHtml(identity.displayName)}头像"/>`;
  }
  const text = escapeHtml(identity.avatarText || [...identity.displayName][0] || "茶");
  return `<div class="avatar avatar-fallback" aria-label="头像占位">${text}</div>`;
}

function renderBody(body) {
  return normalizeBody(body).map(paragraph => `<p>${paragraph.html ?? ""}</p>`).join("\n");
}

export function renderSocialCardPageDocument(fixture, {
  body = fixture.body,
  pageIndex = 0,
  pageCount = 1
} = {}) {
  const { layout, bodyChars, mediaMode } = validateSocialCardFixture(fixture);
  if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= pageCount) {
    throw new Error("模板B页码参数无效");
  }
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > layout.maxPages) {
    throw new Error(`模板B页数必须为1至${layout.maxPages}页`);
  }
  const palette = SOCIAL_CARD_B_PALETTES[fixture.palette];
  const underline = palette.underline ?? palette.accent;
  const isPortrait = mediaMode === "portrait";
  const isContinuation = pageIndex > 0;
  const title = (fixture.titleLines ?? []).map(line => `<span>${escapeHtml(line)}</span>`).join("");
  const documentTitle = isPortrait ? fixture.identity.displayName : fixture.titleLines.join(" ");
  const titleMarkup = isPortrait || isContinuation ? "" : `<h1>${title}</h1>`;
  const mediaMarkup = isPortrait && !isContinuation ? `
        <figure class="portrait-photo">
          <img src="${escapeHtml(fixture.media.url)}" alt="${escapeHtml(fixture.media.alt ?? "竖版配图")}"/>
        </figure>` : "";
  const contentSide = isPortrait ? 152 : 112;
  const pageNumberMarkup = pageCount > 1
    ? `<div class="page-number">${String(pageIndex + 1).padStart(2, "0")}</div>`
    : "";
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(documentTitle)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: ${palette.background}; }
    body { width: ${layout.width}px; min-height: ${layout.height}px; }
    .social-card-page {
      position: relative;
      width: ${layout.width}px;
      height: ${layout.height}px;
      overflow: hidden;
      background: ${palette.background};
      color: ${palette.body};
      -webkit-font-smoothing: antialiased;
    }
    .theme-line {
      position: absolute;
      inset: 0 auto 0 0;
      width: 16px;
      background: ${palette.accent};
    }
    .card-content {
      position: absolute;
      top: 120px;
      right: ${contentSide}px;
      bottom: ${isPortrait ? 144 : 176}px;
      left: ${contentSide}px;
      overflow: hidden;
    }
    .identity-heading {
      display: flex;
      align-items: center;
      height: 124px;
      font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    }
    .avatar {
      flex: 0 0 124px;
      width: 124px;
      height: 124px;
      border-radius: 50%;
      object-fit: cover;
    }
    .avatar-fallback {
      display: grid;
      place-items: center;
      background: ${palette.accent};
      color: ${palette.background};
      font-size: 50px;
      font-weight: 600;
    }
    .identity-copy { margin-left: 36px; min-width: 0; }
    .display-name {
      color: ${palette.body};
      font-size: 40px;
      font-weight: 600;
      line-height: 1.25;
      letter-spacing: 1px;
    }
    .identity-meta {
      display: flex;
      gap: 24px;
      margin-top: 12px;
      color: ${palette.metadata};
      font-size: 28px;
      line-height: 1.35;
      letter-spacing: .5px;
    }
    h1 {
      margin: 124px 0 0;
      color: ${palette.title};
      font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      font-size: 86px;
      font-weight: 600;
      line-height: 1.32;
      letter-spacing: 1px;
    }
    h1 span { display: block; }
    .portrait-photo {
      width: 800px;
      height: 1200px;
      margin: 72px auto 0;
    }
    .portrait-photo img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .post-body {
      margin-top: ${isPortrait ? 44 : isContinuation ? 124 : 68}px;
      color: ${palette.body};
      font-family: "Songti SC", "STSong", "SimSun", serif;
      font-size: ${isPortrait ? 46 : 42}px;
      line-height: ${isPortrait ? 1.82 : 1.92};
      letter-spacing: ${isPortrait ? ".6px" : ".7px"};
      text-align: justify;
      text-justify: inter-ideograph;
      word-break: normal;
      overflow-wrap: break-word;
      line-break: strict;
    }
    .post-body p { margin: 0 0 42px; }
    .post-body p:last-child { margin-bottom: 0; }
    .post-body b { font-weight: 700; }
    .post-body em { font-style: italic; }
    .post-body u {
      text-decoration-color: ${underline};
      text-decoration-thickness: 3px;
      text-underline-offset: 9px;
    }
    .bottom-rule {
      position: absolute;
      right: ${contentSide}px;
      bottom: 108px;
      left: ${contentSide}px;
      height: 3px;
      background: ${palette.accent};
      opacity: .92;
    }
    .page-number {
      position: absolute;
      right: ${contentSide}px;
      bottom: 54px;
      color: ${palette.metadata};
      font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      font-size: 26px;
      line-height: 1;
      letter-spacing: .08em;
    }
  </style>
</head>
<body>
  <section class="social-card-page" data-layout="${fixture.layout}" data-media-mode="${mediaMode}" data-char-count="${bodyChars}" data-page-index="${pageIndex}" data-page-count="${pageCount}">
    <div class="theme-line"></div>
    <main class="card-content">
      <div class="card-content-inner">
        <header class="identity-heading">
          ${renderAvatar(fixture.identity)}
          <div class="identity-copy">
            <div class="display-name">${escapeHtml(fixture.identity.displayName)}</div>
            <div class="identity-meta">
              <span>${escapeHtml(fixture.identity.accountId)}</span>
              <time>${escapeHtml(fixture.publishedAt)}</time>
            </div>
          </div>
        </header>
        ${titleMarkup}${mediaMarkup}
        <article class="post-body">${renderBody(body)}</article>
      </div>
    </main>
    <div class="bottom-rule"></div>
    ${pageNumberMarkup}
  </section>
</body>
</html>`;
}

export function renderSocialCardDocument(fixture) {
  return renderSocialCardPageDocument(fixture);
}

export async function paginateSocialCardBody(fixture, measurePage) {
  const { layout } = validateSocialCardFixture(fixture);
  if (typeof measurePage !== "function") throw new TypeError("缺少模板B真实版面测量函数");
  const body = normalizeBody(fixture.body);
  const single = await measurePage({ body, pageIndex: 0, pageCount: 1 });
  if (!single?.overflow) return [body];
  if (layout.maxPages === 1) {
    throw new Error("朋友圈短版存在真实画布溢出，请缩短正文或切换全文阅读版");
  }
  if (body.length < 2) {
    throw new Error("全文阅读版单个自然段无法在段落边界分页，请先人工拆分自然段");
  }

  let low = 1;
  let high = body.length - 1;
  let splitAt = 0;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const measured = await measurePage({ body: body.slice(0, middle), pageIndex: 0, pageCount: 2 });
    if (measured?.overflow) high = middle - 1;
    else {
      splitAt = middle;
      low = middle + 1;
    }
  }
  if (!splitAt) throw new Error("全文阅读版第一页无法容纳首个自然段，请先人工拆分自然段");
  const pages = [body.slice(0, splitAt), body.slice(splitAt)];
  const second = await measurePage({ body: pages[1], pageIndex: 1, pageCount: 2 });
  if (second?.overflow) {
    throw new Error("模板B两页仍无法容纳当前正文，请删减、移至发布正文或切换模板A/C");
  }
  return pages;
}
