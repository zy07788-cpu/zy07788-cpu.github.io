import { CANVAS, PALETTES, MAX_POST_CHARACTERS, validateProject, setGroupOffset } from "./model.mjs?v=e584159048f79e2b";
export { setGroupOffset };

export const FONTS = Object.freeze({
  title: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  body: '"Songti SC", "STSong", "SimSun", serif',
});
const segmenter = new Intl.Segmenter("zh", { granularity: "grapheme" });
const graphemes = (text) => [...segmenter.segment(text)].map((part) => part.segment);
const normalize = (text) => text.replace(/\r\n?/g, "\n");
const font = (size, weight, family) => ({ size, weight, family });
const fontString = (style) => `${style.weight} ${style.size}px ${style.family}`;

/** The only markup-like notation is paired **bold**; HTML remains literal text. */
export function parseInline(text) {
  const runs = [];
  const pattern = /\*\*([^*\n]+)\*\*/g;
  let position = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > position) runs.push({ text: text.slice(position, match.index), strong: false });
    runs.push({ text: match[1], strong: true });
    position = match.index + match[0].length;
  }
  if (position < text.length) runs.push({ text: text.slice(position), strong: false });
  return runs;
}
function glyphsFor(text, style, measure) {
  return parseInline(text).flatMap((run) => graphemes(run.text).map((text) => {
    const glyphStyle = { ...style, weight: run.strong ? 700 : style.weight };
    const width = measure(text, glyphStyle);
    if (!Number.isFinite(width) || width < 0) throw new TypeError("无法测量文字宽度。");
    return { text, strong: run.strong, width };
  }));
}
function makeLine(glyphs, justify, spacing) {
  return { text: glyphs.map((glyph) => glyph.text).join(""), glyphs, justify, width: glyphs.reduce((sum, glyph) => sum + glyph.width, 0) + Math.max(0, glyphs.length - 1) * spacing };
}

/** Preserve explicit breaks and graphemes; only soft-wrapped lines justify. */
export function wrapText(text, style, width, measure, spacing = .7) {
  if (!Number.isFinite(width) || width <= 0) throw new TypeError("可用文字宽度必须大于0。");
  const lines = [];
  for (const explicitLine of normalize(text).split("\n")) {
    let row = [], rowWidth = 0;
    for (const glyph of glyphsFor(explicitLine, style, measure)) {
      const nextWidth = rowWidth + (row.length ? spacing : 0) + glyph.width;
      if (row.length && nextWidth > width) {
        lines.push(makeLine(row, true, spacing));
        row = [glyph]; rowWidth = glyph.width;
      } else { row.push(glyph); rowWidth = nextWidth; }
    }
    lines.push(makeLine(row, false, spacing));
  }
  return lines;
}
export function visibleCharacterCount(text) {
  return normalize(text).split("\n").reduce((sum, line) => sum + graphemes(parseInline(line).map((run) => run.text).join("")).filter((glyph) => !/^\s+$/u.test(glyph)).length, 0);
}
function movedBox(x, y, width, height, offset) { return { x: x + offset.x, y: y + offset.y, width, height }; }
function maximumWidth(lines, available) { return Math.max(0, ...lines.map((line) => line.justify ? Math.max(available, line.width) : line.width)); }
function inside(box, area) {
  return !box || (box.x >= area.x - .05 && box.y >= area.y - .05 && box.x + box.width <= area.x + area.width + .05 && box.y + box.height <= area.y + area.height + .05);
}
function overlap(a, b) {
  return a && b && a.width > 0 && b.width > 0 && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Geometry is shared by drawing, hit testing and the export guard. */
export function computeLayout(input, measure) {
  if (typeof measure !== "function") throw new TypeError("缺少文字测量方法。");
  const project = validateProject(input), style = project.styles[project.backgroundId], content = project.content;
  const safeArea = { x: style.side, y: style.top, width: CANVAS.width - 2 * style.side, height: CANVAS.height - style.top - style.bottom };
  const errors = [];
  if (safeArea.height <= 0) errors.push("上下留白过大，请扩大文字安全区。");
  const titleFont = font(style.titleSize, 600, FONTS.title), bodyFont = font(style.bodySize, 400, FONTS.body);
  const nameFont = font(40, 600, FONTS.title), metaFont = font(28, 400, FONTS.title);
  const hasIdentity = [content.displayName, content.accountId, content.publishedAt, content.avatarText].some((value) => value.trim());
  const hasAvatar = Boolean(content.avatarText.trim() || content.displayName.trim());
  const identityX = safeArea.x + style.offsets.identity.x, identityY = safeArea.y + style.offsets.identity.y;
  const avatarText = graphemes(content.avatarText.trim() ? content.avatarText : content.displayName)[0] || "";
  const meta = [content.accountId, content.publishedAt].filter((value) => value.trim());
  const spacedWidth = (text, style, spacing) => graphemes(text).reduce((sum, glyph) => sum + measure(glyph, style), 0) + Math.max(0, graphemes(text).length - 1) * spacing;
  const metaWidths = meta.map((value) => spacedWidth(value, metaFont, .5));
  const metaWidth = metaWidths.reduce((sum, width) => sum + width, 0) + Math.max(0, metaWidths.length - 1) * 24;
  const nameWidth = content.displayName ? spacedWidth(content.displayName, nameFont, 1) : 0;
  const copyX = identityX + (hasAvatar ? 160 : 0);
  const copyHeight = (content.displayName ? 50 : 0) + (meta.length ? (content.displayName ? 12 : 0) + 37.8 : 0);
  const copyTop = identityY + (124 - copyHeight) / 2;
  const identity = hasIdentity ? {
    avatar: hasAvatar ? { x: identityX, y: identityY, size: 124, text: avatarText } : null,
    name: content.displayName ? { text: content.displayName, x: copyX, y: copyTop, style: nameFont, lineHeight: 50, spacing: 1 } : null,
    meta: meta.map((text, index) => ({ text, x: copyX + metaWidths.slice(0, index).reduce((sum, width) => sum + width + 24, 0), y: copyTop + (content.displayName ? 62 : 0), style: metaFont, lineHeight: 37.8, spacing: .5 })),
  } : null;
  const identityWidth = Math.max(hasAvatar ? 124 : 0, (hasAvatar ? 160 : 0) + Math.max(nameWidth, metaWidth));
  const identityBounds = hasIdentity ? { x: identityX, y: identityY, width: identityWidth, height: 124 } : null;

  const hasTitle = Boolean(content.title.trim());
  const titleLines = hasTitle ? wrapText(content.title, titleFont, safeArea.width, measure, 1) : [];
  const titleLineHeight = style.titleSize * 1.28;
  // The original solid title uses 1.32; paper uses the approved V2's 1.28.
  const actualTitleLineHeight = project.backgroundId === "solid" ? style.titleSize * 1.32 : titleLineHeight;
  const titleBaseY = safeArea.y + (hasIdentity ? 124 + style.titleGap : 0);
  const titleBounds = hasTitle ? movedBox(safeArea.x, titleBaseY, maximumWidth(titleLines, safeArea.width), titleLines.length * actualTitleLineHeight, style.offsets.title) : null;
  if (titleLines.length > 2) errors.push("标题超过两行，请缩短文字或调整标题字号与边距。");
  const bodyBaseY = hasTitle ? titleBaseY + titleLines.length * actualTitleLineHeight + style.bodyGap : safeArea.y + (hasIdentity ? 124 + style.bodyGap : 0);
  const bodyX = safeArea.x + style.offsets.body.x, bodyY = bodyBaseY + style.offsets.body.y;
  const bodyLines = [];
  let y = bodyY;
  const hasBody = Boolean(content.body.trim());
  if (!hasBody) errors.push("写下正文后即可导出图片。");
  if (visibleCharacterCount(content.body) > MAX_POST_CHARACTERS) errors.push(`朋友圈短版最多${MAX_POST_CHARACTERS}字，内容已完整保留，请缩短后导出。`);
  if (hasBody) {
    const paragraphs = normalize(content.body).split("\n\n");
    for (const [index, paragraph] of paragraphs.entries()) {
      for (const line of wrapText(paragraph, bodyFont, safeArea.width, measure)) {
        bodyLines.push({ ...line, x: bodyX, y, style: bodyFont, lineHeight: style.bodySize * style.lineHeight, spacing: .7 });
        y += style.bodySize * style.lineHeight;
      }
      if (index < paragraphs.length - 1) y += style.paragraphGap;
    }
  }
  const bodyBounds = hasBody ? { x: bodyX, y: bodyY, width: maximumWidth(bodyLines, safeArea.width), height: y - bodyY } : null;
  const bounds = { identity: identityBounds, title: titleBounds, body: bodyBounds };
  const labels = { identity: "名字与日期", title: "标题", body: "正文" };
  for (const [name, box] of Object.entries(bounds)) if (!inside(box, safeArea)) errors.push(`${labels[name]}超出文字安全区，请调整位置、字号或留白。`);
  for (const [a, b] of [["identity", "title"], ["identity", "body"], ["title", "body"]]) {
    if (overlap(bounds[a], bounds[b])) errors.push(`${labels[a]}与${labels[b]}重叠，请调整位置。`);
  }
  return { ok: errors.length === 0, errors, bounds, safeArea, project, style, identity, titleFont, titleLines, titleLineHeight: actualTitleLineHeight, titleBaseY, bodyLines, bodyFont };
}

function textBaseline(context, style, lineHeight) {
  context.font = fontString(style);
  const metrics = context.measureText("国Mg");
  const ascent = metrics.fontBoundingBoxAscent ?? style.size * .9;
  const descent = metrics.fontBoundingBoxDescent ?? style.size * .25;
  return (lineHeight - ascent - descent) / 2 + ascent;
}
function drawText(context, text, x, y, style, lineHeight, colour, spacing = 0) {
  context.fillStyle = colour;
  context.font = fontString(style);
  context.textBaseline = "alphabetic";
  const baseline = y + textBaseline(context, style, lineHeight);
  let cursor = x;
  for (const glyph of graphemes(text)) {
    context.fillText(glyph, cursor, baseline);
    cursor += context.measureText(glyph).width + spacing;
  }
}
function drawLine(context, line, x, y, style, lineHeight, colour, available, spacing) {
  const extra = line.justify && line.glyphs.length > 1 ? Math.max(0, available - line.width) / (line.glyphs.length - 1) : 0;
  let cursor = x;
  for (const glyph of line.glyphs) {
    const glyphStyle = glyph.strong ? { ...style, weight: 700 } : style;
    drawText(context, glyph.text, cursor, y, glyphStyle, lineHeight, colour);
    cursor += glyph.width + spacing + extra;
  }
}
function outline(context, box, colour, dashed = false) {
  if (!box || box.width < 0 || box.height < 0) return;
  context.strokeStyle = colour; context.lineWidth = 3;
  context.setLineDash(dashed ? [12, 10] : []);
  context.strokeRect(box.x, box.y, box.width, box.height);
  context.setLineDash([]);
}

export function renderProject(canvas, input, { backgroundImage = null, selected = null, safeArea = false } = {}) {
  const context = canvas?.getContext?.("2d");
  if (!context) return { ok: false, errors: ["当前浏览器不能生成图片，请使用支持画布的浏览器。"], bounds: {}, safeArea: null };
  if (canvas.width !== CANVAS.width) canvas.width = CANVAS.width;
  if (canvas.height !== CANVAS.height) canvas.height = CANVAS.height;
  let layout;
  try {
    layout = computeLayout(input, (text, style) => { context.font = fontString(style); if ("letterSpacing" in context) context.letterSpacing = "0px"; return context.measureText(text).width; });
  } catch (error) {
    return { ok: false, errors: [error.message || "工程格式无效。"], bounds: {}, safeArea: null };
  }
  context.save();
  try {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1; context.textAlign = "left";
    if ("letterSpacing" in context) context.letterSpacing = "0px";
    const { project, style } = layout;
    const palette = PALETTES[project.solidPalette];
    context.fillStyle = project.backgroundId === "paper" ? "#e1e6df" : palette.background;
    context.fillRect(0, 0, CANVAS.width, CANVAS.height);
    if (project.backgroundId === "paper") {
      const imageWidth = backgroundImage?.naturalWidth ?? backgroundImage?.width ?? 0;
      const imageHeight = backgroundImage?.naturalHeight ?? backgroundImage?.height ?? 0;
      if (imageWidth > 0 && imageHeight > 0) {
        try { context.drawImage(backgroundImage, -CANVAS.width * .035, -CANVAS.height * .025, CANVAS.width * 1.07, CANVAS.height * 1.05); }
        catch { layout.errors.push("纸画底图未能绘制，请重新加载后再导出。"); }
      } else layout.errors.push("纸画底图尚未加载，暂不能导出图片。");
    } else {
      context.fillStyle = style.accentColor; context.fillRect(0, 0, 16, CANVAS.height);
      context.globalAlpha = .92; context.fillRect(style.side, CANVAS.height - 108, CANVAS.width - 2 * style.side, 3); context.globalAlpha = 1;
    }
    const identity = layout.identity;
    if (identity?.avatar) {
      const avatar = identity.avatar;
      context.fillStyle = style.accentColor;
      context.beginPath(); context.arc(avatar.x + avatar.size / 2, avatar.y + avatar.size / 2, avatar.size / 2, 0, Math.PI * 2); context.fill();
      const avatarFont = font(50, 600, FONTS.title);
      context.font = fontString(avatarFont);
      const width = context.measureText(avatar.text).width;
      drawText(context, avatar.text, avatar.x + (avatar.size - width) / 2, avatar.y, avatarFont, avatar.size, project.backgroundId === "paper" ? PALETTES["雾灰墨蓝"].background : palette.background);
    }
    if (identity?.name) { const name = identity.name; drawText(context, name.text, name.x, name.y, name.style, name.lineHeight, style.bodyColor, name.spacing); }
    for (const mark of identity?.meta ?? []) drawText(context, mark.text, mark.x, mark.y, mark.style, mark.lineHeight, style.metadataColor, mark.spacing);
    const titleBounds = layout.bounds.title;
    if (titleBounds) for (const [index, line] of layout.titleLines.entries()) drawLine(context, { ...line, justify: false }, titleBounds.x, titleBounds.y + index * layout.titleLineHeight, layout.titleFont, layout.titleLineHeight, style.titleColor, layout.safeArea.width, 1);
    for (const line of layout.bodyLines) drawLine(context, line, line.x, line.y, line.style, line.lineHeight, style.bodyColor, layout.safeArea.width, line.spacing);
    if (safeArea) outline(context, layout.safeArea, "#52786b", true);
    if (selected && layout.bounds[selected]) outline(context, layout.bounds[selected], "#4b7183");
  } finally { context.restore(); }
  layout.ok = layout.errors.length === 0;
  return { ok: layout.ok, errors: layout.errors, bounds: layout.bounds, safeArea: layout.safeArea };
}
export function hitTest(result, x, y) {
  if (!result?.bounds || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return ["body", "title", "identity"].find((group) => {
    const box = result.bounds[group];
    return box && x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
  }) ?? null;
}
