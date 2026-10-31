import { SOCIAL_CARD_B_LAYOUTS, SOCIAL_CARD_B_PALETTES } from "../../templates/xiaohongshu-social-card-b/core.mjs?v=e584159048f79e2b";

export const CANVAS = Object.freeze({ width: SOCIAL_CARD_B_LAYOUTS.moments.width, height: SOCIAL_CARD_B_LAYOUTS.moments.height });
export const PALETTES = SOCIAL_CARD_B_PALETTES;
export const BACKGROUNDS = Object.freeze({
  solid: Object.freeze({ label: "纯色", image: null }),
  paper: Object.freeze({ label: "雾蓝纸画", image: new URL("./assets/mist-sage-v2.png", import.meta.url).href }),
});
export const MAX_DRAFT_CHARACTERS = 10000;
export const MAX_POST_CHARACTERS = 260;
const GROUPS = ["identity", "title", "body"];
const NUMBERS = Object.freeze({
  top: [0, 1200], side: [0, 640], bottom: [0, 1600],
  titleSize: [24, 140], bodySize: [20, 80], titleGap: [0, 360], bodyGap: [0, 240],
  lineHeight: [1.2, 2.6], paragraphGap: [0, 160],
});
const COLOURS = ["titleColor", "bodyColor", "accentColor", "metadataColor"];
const CONTENT_LIMITS = Object.freeze({ displayName: 80, accountId: 120, publishedAt: 80, avatarText: 8, title: 300, body: MAX_DRAFT_CHARACTERS });
const FIELD_LABELS = Object.freeze({ displayName: "昵称", accountId: "账号或备注", publishedAt: "日期", avatarText: "头像文字", title: "标题", body: "正文", top: "上方留白", side: "左右留白", bottom: "底部留白", titleSize: "标题字号", bodySize: "正文字号", titleGap: "标题上方间距", bodyGap: "正文上方间距", lineHeight: "正文行距", paragraphGap: "段间距" });
const BASES = Object.freeze({
  solid: Object.freeze({ top: 120, side: 112, bottom: 176, titleSize: 86, bodySize: 42, titleGap: 124, bodyGap: 68, lineHeight: 1.92, paragraphGap: 42 }),
  paper: Object.freeze({ top: 212, side: 192, bottom: 440, titleSize: 80, bodySize: 42, titleGap: 84, bodyGap: 56, lineHeight: 1.85, paragraphGap: 34 }),
});
const SAMPLE = Object.freeze({
  displayName: "记录者", accountId: "排版样例 · 未发布", publishedAt: "2026.10.31", avatarText: "记",
  title: "让日常，\n多一点手感",
  body: "**底材有质感。**\n能看见笔触、颗粒和颜色变化。\n\n**主体有层次。**\n包装袋、风景、文字各占一个位置，有遮挡和投影。\n\n**卡片有个性。**\n不同颜色和插画，让每个页面项目都容易被记住。",
});
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const stringLength = (value) => [...value].length;

function styleFor(background, palette) {
  return {
    ...BASES[background], titleColor: palette.title, bodyColor: palette.body,
    accentColor: palette.accent, metadataColor: palette.metadata,
    offsets: Object.fromEntries(GROUPS.map((group) => [group, { x: 0, y: 0 }])),
  };
}
export function createProject({ sample = true } = {}) {
  return {
    schemaVersion: 1, templateId: "xiaohongshu.social-card-b", templateVersion: 1,
    backgroundId: "paper", solidPalette: "雾灰墨蓝",
    content: sample ? { ...SAMPLE } : Object.fromEntries(Object.keys(CONTENT_LIMITS).map((key) => [key, ""])),
    styles: { solid: styleFor("solid", PALETTES["雾灰墨蓝"]), paper: styleFor("paper", PALETTES["雾灰墨蓝"]) },
  };
}

function plainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError(`${label}必须是普通对象。`);
  }
}
function guardTree(value, depth = 0) {
  if (depth > 8) throw new TypeError("工程结构过深。");
  if (["function", "symbol", "bigint", "undefined"].includes(typeof value)) throw new TypeError("工程字段类型不受支持。");
  if (value && typeof value === "object") {
    plainObject(value, "工程字段");
    if (Object.getOwnPropertySymbols(value).length) throw new TypeError("工程包含不支持的字段。");
    for (const key of Object.keys(value)) {
      if (["__proto__", "constructor", "prototype"].includes(key)) throw new TypeError("工程包含不允许的字段。");
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!own(descriptor, "value")) throw new TypeError("工程不允许动态属性。");
      guardTree(descriptor.value, depth + 1);
    }
  }
}
function exactKeys(value, keys, label) {
  plainObject(value, label);
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key)) || keys.some((key) => !own(value, key))) {
    throw new TypeError(`${label}字段不完整或包含不支持的设置。`);
  }
}
function number(value, min, max, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new TypeError(`${label}须在${min}至${max}之间。`);
  return value;
}
function validateStyle(value, label) {
  exactKeys(value, [...Object.keys(NUMBERS), ...COLOURS, "offsets"], label);
  const result = {};
  for (const [key, [min, max]] of Object.entries(NUMBERS)) result[key] = number(value[key], min, max, `${label}${FIELD_LABELS[key]}`);
  for (const key of COLOURS) {
    if (typeof value[key] !== "string" || !/^#[0-9a-f]{6}$/i.test(value[key])) throw new TypeError(`${label}颜色须为六位十六进制色值。`);
    result[key] = value[key];
  }
  exactKeys(value.offsets, GROUPS, `${label}位置`);
  result.offsets = {};
  for (const group of GROUPS) {
    exactKeys(value.offsets[group], ["x", "y"], `${label}${group}位置`);
    result.offsets[group] = {
      x: number(value.offsets[group].x, -CANVAS.width, CANVAS.width, "横向偏移"),
      y: number(value.offsets[group].y, -CANVAS.height, CANVAS.height, "纵向偏移"),
    };
  }
  return result;
}

/** Validate the complete allowlisted project; never accept resource URLs from imports. */
export function validateProject(value) {
  guardTree(value);
  exactKeys(value, ["schemaVersion", "templateId", "templateVersion", "backgroundId", "solidPalette", "content", "styles"], "工程");
  if (value.schemaVersion !== 1 || value.templateId !== "xiaohongshu.social-card-b" || value.templateVersion !== 1) {
    throw new TypeError("工程或模板版本不受支持，请使用当前朋友圈B编辑器的工程文件。");
  }
  if (typeof value.backgroundId !== "string" || !own(BACKGROUNDS, value.backgroundId)) throw new TypeError("工程背景不受支持，不能载入外部图片地址。");
  if (typeof value.solidPalette !== "string" || !own(PALETTES, value.solidPalette)) throw new TypeError("工程配色不受支持。");
  exactKeys(value.content, Object.keys(CONTENT_LIMITS), "文字内容");
  const content = {};
  for (const [key, limit] of Object.entries(CONTENT_LIMITS)) {
    if (typeof value.content[key] !== "string" || stringLength(value.content[key]) > limit || /\u0000/.test(value.content[key])) {
      throw new TypeError(`${FIELD_LABELS[key]}须为${limit}字以内的普通文字。`);
    }
    content[key] = value.content[key];
  }
  exactKeys(value.styles, ["solid", "paper"], "背景版面");
  return {
    schemaVersion: 1, templateId: value.templateId, templateVersion: 1,
    backgroundId: value.backgroundId, solidPalette: value.solidPalette, content,
    styles: { solid: validateStyle(value.styles.solid, "纯色版"), paper: validateStyle(value.styles.paper, "纸画版") },
  };
}
export function parseProject(json) {
  if (typeof json !== "string" || json.length > 500000) throw new TypeError("工程文件过大或格式无效。");
  let value;
  try { value = JSON.parse(json); } catch { throw new TypeError("工程文件不是有效的JSON，请选择已保存的工程文件。"); }
  return validateProject(value);
}
export function serializeProject(project) { return JSON.stringify(validateProject(project), null, 2); }
export function changeBackground(project, id) {
  const next = validateProject(project);
  if (typeof id !== "string" || !own(BACKGROUNDS, id)) throw new TypeError("不支持这个背景。");
  next.backgroundId = id;
  return next;
}
export function withPalette(project, key) {
  const next = validateProject(project);
  if (typeof key !== "string" || !own(PALETTES, key)) throw new TypeError("不支持这个配色。");
  next.solidPalette = key;
  const palette = PALETTES[key];
  Object.assign(next.styles.solid, { titleColor: palette.title, bodyColor: palette.body, accentColor: palette.accent, metadataColor: palette.metadata });
  return next;
}
export function resetLayout(project) {
  const next = validateProject(project);
  const current = next.styles[next.backgroundId];
  Object.assign(current, BASES[next.backgroundId]);
  current.offsets = Object.fromEntries(GROUPS.map((group) => [group, { x: 0, y: 0 }]));
  return next;
}
export function setGroupOffset(project, group, offset) {
  const next = validateProject(project);
  if (!GROUPS.includes(group)) throw new TypeError("请选择名字、标题或正文。");
  plainObject(offset, "位置");
  if (!Number.isFinite(offset.x) || !Number.isFinite(offset.y)) throw new TypeError("位置必须是有效数字。");
  next.styles[next.backgroundId].offsets[group] = {
    x: Math.max(-CANVAS.width, Math.min(CANVAS.width, offset.x)),
    y: Math.max(-CANVAS.height, Math.min(CANVAS.height, offset.y)),
  };
  return next;
}
export function describeProject(project) {
  const value = validateProject(project), style = value.styles[value.backgroundId];
  return [
    "# 朋友圈B排版工程", "", `模板：${value.templateId}，版本${value.templateVersion}`,
    `背景：${BACKGROUNDS[value.backgroundId].label}`, `画布：${CANVAS.width} × ${CANVAS.height}`,
    `标题：${value.content.title.replace(/\r?\n/g, " / ") || "（未填）"}`,
    `安全区：上${style.top}，左右${style.side}，下${style.bottom}`,
    `字号：标题${style.titleSize}，正文${style.bodySize}；正文行高${style.lineHeight}，段距${style.paragraphGap}`,
    `文字颜色：标题${style.titleColor}，正文${style.bodyColor}`,
    `位置偏移：${JSON.stringify(style.offsets)}`, "",
    "正文、身份及两种背景的参数均在project.json中；此材料由编辑器导出，不会自动发到聊天。",
  ].join("\n");
}
