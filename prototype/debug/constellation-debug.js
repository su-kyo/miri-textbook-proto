import { getInitialHomeConstellations, loadConstellationCatalog } from "../../shared/js/constellation-adapter.js";

function pickAcquiredIds(catalog, percent) {
  const count = Math.max(1, Math.round((catalog.length * percent) / 100));
  return [...catalog]
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .map((item) => item.id);
}

export function buildConstellationDebugMarkup(state) {
  return `
    <section class="debug-panel">
      <div class="debug-panel__title">Constellation Debug</div>
      <div class="debug-panel__actions">
        <button class="chip-button" data-debug-mode="locked">전체 Locked</button>
        <button class="chip-button" data-debug-mode="partial">일부 획득</button>
        <button class="chip-button" data-debug-reroll="true">랜덤 재배정</button>
      </div>
      <div class="debug-panel__actions">
        <button class="chip-button" data-debug-percent="10">10%</button>
        <button class="chip-button" data-debug-percent="50">50%</button>
        <button class="chip-button" data-debug-percent="100">100%</button>
      </div>
    </section>
  `;
}

function resizeAcquiredIds(catalog, currentIds, percent) {
  if (percent <= 0) {
    return [];
  }

  const count = Math.max(1, Math.round((catalog.length * percent) / 100));
  const stableIds = [...new Set([...(currentIds ?? []), ...catalog.map((item) => item.id)])];
  return stableIds.slice(0, count);
}

export function wireConstellationDebug(root, store) {
  root.querySelectorAll("[data-debug-mode]").forEach((button) => {
    button.addEventListener("click", async () => {
      const mode = button.getAttribute("data-debug-mode");
      const percent = mode === "locked" ? 0 : Math.max(5, store.getState().constellationDebug.percent || 35);
      const nextConstellations = await getInitialHomeConstellations();
      const catalog = await loadConstellationCatalog();
      const acquiredIds = mode === "locked" ? [] : pickAcquiredIds(catalog, percent);
      store.update((state) => ({
        ...state,
        homeConstellationIds: nextConstellations.map((item) => item.id),
        recentConstellationIds: acquiredIds,
        constellationDebug: {
          ...state.constellationDebug,
          mode: percent >= 100 ? "full" : mode,
          percent,
          acquiredIds,
        },
      }));
    });
  });

  root.querySelectorAll("[data-debug-reroll]").forEach((button) => {
    button.addEventListener("click", async () => {
      const nextConstellations = await getInitialHomeConstellations();
      store.update((state) => ({
        ...state,
        homeConstellationIds: nextConstellations.map((item) => item.id),
      }));
    });
  });

  root.querySelectorAll("[data-debug-percent]").forEach((button) => {
    button.addEventListener("click", async () => {
      const percent = Number(button.getAttribute("data-debug-percent"));
      const catalog = await loadConstellationCatalog();
      const acquiredIds = resizeAcquiredIds(catalog, store.getState().constellationDebug.acquiredIds ?? [], percent);
      store.update((state) => ({
        ...state,
        recentConstellationIds: acquiredIds,
        constellationDebug: {
          ...state.constellationDebug,
          mode: percent <= 0 ? "locked" : percent >= 100 ? "full" : "partial",
          percent,
          acquiredIds,
        },
      }));
    });
  });
}
