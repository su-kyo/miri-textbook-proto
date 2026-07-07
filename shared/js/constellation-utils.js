export function shuffleList(list, random = Math.random) {
  const clone = [...list];

  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
  }

  return clone;
}

export function pickRandomConstellations(list, count, random = Math.random) {
  return shuffleList(list, random).slice(0, count);
}

export function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

export function percentToLightCount(requiredLight, percent) {
  const safePercent = clampPercent(percent);

  if (safePercent <= 0) {
    return 0;
  }

  return Math.min(requiredLight, Math.max(1, Math.round((requiredLight * safePercent) / 100)));
}

export function buildProgressSegments(requiredLight, obtainedLight) {
  return Array.from({ length: requiredLight }, (_, index) => ({
    index,
    active: index < obtainedLight,
  }));
}

export function getConstellationAsset(item, completed) {
  return completed ? item.illustration : item.hidden ?? item.illustration;
}

export function buildDuplicateCount(percent, random = Math.random) {
  if (clampPercent(percent) < 100) {
    return 0;
  }

  return Math.floor(random() * 3) + 1;
}
