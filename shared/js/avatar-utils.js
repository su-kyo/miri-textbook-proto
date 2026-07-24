import { DEFAULT_AVATAR } from "./app-config.js?v=20260724a";
import { loadText, resolveProjectUrl } from "./data-loader.js?v=20260724a";

const HEAD_REPLACEMENTS = {
  "#C3ED39": "body",
  "#9EE124": "belly",
  "#0F604A": "neck",
  "#F6908C": "cheeks",
};

const FOREHEAD_REPLACEMENTS = {
  "#75D41A": "forehead",
};

const svgCache = new Map();

export const AVATAR_THEME_COLORS = {
  green: {
    body: "#C3ED39",
    neck: "#0F604A",
    belly: "#9EE124",
    cheeks: "#F6908C",
    forehead: "#75D41A",
  },
  pink: {
    body: "#FEA0CC",
    neck: "#EB3884",
    belly: "#F881B7",
    cheeks: "#FD7E90",
    forehead: "#F85195",
  },
  blue: {
    body: "#86D8FD",
    neck: "#1550BB",
    belly: "#5AC2F7",
    cheeks: "#FC939E",
    forehead: "#2BADF2",
  },
};

function pad(index) {
  return String(index).padStart(2, "0");
}

function replaceColors(svgText, replacementMap, themeColors) {
  return Object.entries(replacementMap).reduce((text, [source, token]) => {
    const target = themeColors[token];
    return text.split(source).join(target);
  }, svgText);
}

async function loadSvg(path) {
  if (!svgCache.has(path)) {
    svgCache.set(path, loadText(path));
  }

  return svgCache.get(path);
}

export function getAvatarAssetPath(part, index) {
  return `asset/avatar/${part}/${part}__${pad(index)}.svg`;
}

export function getAvatarPreviewAssetPath(part, index) {
  return `asset/avatar/preview/${part}/${part}-preview-${pad(index)}.svg`;
}

export async function buildAvatarMarkup(config = DEFAULT_AVATAR, options = {}) {
  const merged = { ...DEFAULT_AVATAR, ...config };
  const themeColors = AVATAR_THEME_COLORS[merged.theme] ?? AVATAR_THEME_COLORS.green;
  const sizeClass = options.small ? "avatar-stack avatar-stack--small" : "avatar-stack";
  const headSvg = replaceColors(
    await loadSvg(getAvatarAssetPath("head", merged.head)),
    HEAD_REPLACEMENTS,
    themeColors,
  );
  const foreheadSvg = replaceColors(
    await loadSvg(getAvatarAssetPath("forehead", merged.forehead)),
    FOREHEAD_REPLACEMENTS,
    themeColors,
  );
  const eyeSrc = resolveProjectUrl(getAvatarAssetPath("eye", merged.eye));
  const mouthSrc = resolveProjectUrl(getAvatarAssetPath("mouth", merged.mouth));

  return `
    <div class="${sizeClass}" data-avatar-theme="${merged.theme}">
      <div class="avatar-stack__layer">${headSvg}</div>
      <div class="avatar-stack__layer">${foreheadSvg}</div>
      <div class="avatar-stack__layer"><img src="${eyeSrc}" alt="" /></div>
      <div class="avatar-stack__layer"><img src="${mouthSrc}" alt="" /></div>
    </div>
  `;
}
