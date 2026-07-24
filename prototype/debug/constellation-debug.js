import { getConstellationById, getInitialHomeConstellations } from "../../shared/js/constellation-adapter.js?v=20260724a";

async function buildPresetState(ids, preset) {
  const entries = await Promise.all(
    ids.map(async (id) => {
      const constellation = await getConstellationById(id);
      if (!constellation) {
        return null;
      }

      const requiredLight = Math.max(1, Number(constellation.requiredLight) || 1);
      const percent = preset >= 100 ? 100 : preset >= 99 ? Math.round(((requiredLight - 1) / requiredLight) * 100) : 0;

      return [
        id,
        {
          percent,
          duplicateCount: 0,
          phase: percent >= 100 ? "completed" : "idle",
        },
      ];
    }),
  );

  return Object.fromEntries(entries.filter(Boolean));
}

async function applyPreset(store, preset, reroll = false) {
  const nextIds = reroll ? (await getInitialHomeConstellations()).map((item) => item.id) : [...(store.getState().homeConstellationIds ?? [])];
  const nextStateMap = await buildPresetState(nextIds, preset);

  store.update((state) => ({
    ...state,
    homeConstellationIds: nextIds,
    homeConstellationState: nextStateMap,
    constellationDebug: {
      preset,
    },
    activeConstellationId: null,
    activeConstellationSource: null,
    rewardModal: null,
    flashingConstellationIds: [],
  }));
}

export function buildConstellationDebugMarkup(state) {
  const preset = Number(state.constellationDebug?.preset ?? 0);

  return `
    <section class="debug-panel">
      <div class="debug-panel__title">Constellation Debug</div>
      <div class="debug-panel__actions">
        ${[0, 99, 100]
          .map(
            (value) => `
              <button class="chip-button ${preset === value ? "is-selected" : ""}" data-debug-preset="${value}">
                ${value}%
              </button>
            `,
          )
          .join("")}
      </div>
      <div class="debug-panel__actions">
        <button class="chip-button" data-debug-reroll="true">랜덤 재배정</button>
      </div>
    </section>
  `;
}

export function wireConstellationDebug(root, store) {
  root.querySelectorAll("[data-debug-preset]").forEach((button) => {
    button.addEventListener("click", async () => {
      const preset = Number(button.getAttribute("data-debug-preset") ?? 0);
      await applyPreset(store, preset, false);
    });
  });

  root.querySelectorAll("[data-debug-reroll]").forEach((button) => {
    button.addEventListener("click", async () => {
      const preset = Number(store.getState().constellationDebug?.preset ?? 0);
      await applyPreset(store, preset, true);
    });
  });
}
