const jsonCache = new Map();
const textCache = new Map();

export function resolveProjectUrl(path) {
  return new URL(path, document.baseURI).href;
}

async function fetchCached(cache, path, responseType) {
  if (!cache.has(path)) {
    const url = resolveProjectUrl(path);
    const request = fetch(url).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load ${path}: ${response.status}`);
      }

      return responseType === "json" ? response.json() : response.text();
    });

    cache.set(path, request);
  }

  return cache.get(path);
}

export async function loadJson(path) {
  return fetchCached(jsonCache, path, "json");
}

export async function loadText(path) {
  return fetchCached(textCache, path, "text");
}

export async function loadLearningContentRaw() {
  return loadJson("data/learning_content.json");
}

export async function loadConstellationsRaw() {
  return loadJson("data/constellations.json");
}
