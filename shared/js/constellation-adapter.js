import { HOME_CONSTELLATION_COUNT } from "./app-config.js?v=20260724a";
import { loadConstellationsRaw } from "./data-loader.js?v=20260724a";
import {
  buildDuplicateCount,
  buildProgressSegments,
  clampPercent,
  getConstellationAsset,
  percentToLightCount,
  pickRandomConstellations,
} from "./constellation-utils.js?v=20260724a";

let cachedCatalog = null;

function findConstellation(catalog, id) {
  return catalog.find((item) => item.id === id) ?? null;
}

export async function loadConstellationCatalog() {
  if (!cachedCatalog) {
    const catalog = await loadConstellationsRaw();
    cachedCatalog = Array.isArray(catalog) ? catalog : [];
  }

  return cachedCatalog;
}

export async function getConstellationById(id) {
  const catalog = await loadConstellationCatalog();
  return findConstellation(catalog, id);
}

export async function getInitialHomeConstellations(random = Math.random) {
  const catalog = await loadConstellationCatalog();
  return pickRandomConstellations(catalog, HOME_CONSTELLATION_COUNT, random);
}

export function buildConstellationCardState(item, cardState = {}, debugState = { mode: "default", percent: 0 }, random = Math.random) {
  let percent = clampPercent(cardState.percent);
  let duplicateCount = cardState.duplicateCount ?? 0;

  if (debugState.mode === "locked") {
    percent = 0;
    duplicateCount = 0;
  } else if (debugState.mode === "partial") {
    const isAcquired = (debugState.acquiredIds ?? []).includes(item.id);
    percent = isAcquired ? 100 : 0;
    duplicateCount = 0;
  } else if (debugState.mode === "full") {
    percent = 100;
    duplicateCount = buildDuplicateCount(100, random);
  }

  const obtainedLight = percentToLightCount(item.requiredLight, percent);
  const completed = obtainedLight >= item.requiredLight;

  return {
    ...item,
    phase: cardState.phase ?? (completed ? "completed" : "idle"),
    completed,
    percent,
    obtainedLight,
    progressSegments: buildProgressSegments(item.requiredLight, obtainedLight),
    duplicateCount,
    asset: getConstellationAsset(item, completed),
  };
}

export async function buildHomeConstellationCards(ids, homeStateMap = {}, debugState = { mode: "default" }, random = Math.random) {
  const catalog = await loadConstellationCatalog();

  return ids
    .map((id) => findConstellation(catalog, id))
    .filter(Boolean)
    .map((item) => buildConstellationCardState(item, homeStateMap[item.id] ?? {}, debugState, random));
}

export async function buildConstellationCatalogCards(catalogStateMap = {}, recentIds = [], debugState = { mode: "default" }, random = Math.random) {
  const catalog = await loadConstellationCatalog();
  const ranked = [...catalog].sort((left, right) => {
    const leftIndex = recentIds.indexOf(left.id);
    const rightIndex = recentIds.indexOf(right.id);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.nameKo.localeCompare(right.nameKo, "ko");
    }

    if (leftIndex === -1) {
      return 1;
    }

    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  });

  return ranked.map((item) => buildConstellationCardState(item, catalogStateMap[item.id] ?? {}, debugState, random));
}
