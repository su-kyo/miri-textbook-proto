import { buildConstellationDebugMarkup } from "./constellation-debug.js?v=20260725a";

export function buildHomeDebugMarkup(state) {
  if (!state.homeDebugOpen) {
    return "";
  }

  const selectedCount = Number(state.homeDebugStarCount ?? 1);

  return `
    <div class="modal-layer fade-in">
      <div class="modal-backdrop" data-home-debug-toggle-close="true"></div>
      <div class="modal-card modal-card--home slide-up">
        <div class="modal-card__header modal-card__header--home">
          <div class="modal-card__title modal-card__title--home">Home Debug</div>
          <button class="icon-button icon-button--clear" type="button" data-home-debug-toggle-close="true">×</button>
        </div>
        <div class="modal-card__body modal-card__body--home">
          <div class="debug-panel">
            <div class="debug-panel__title">획득 흐름 실행</div>
            <div class="debug-panel__actions">
              ${[1, 2]
                .map(
                  (count) => `
                    <button class="chip-button ${selectedCount === count ? "is-selected" : ""}" data-home-debug-star-count="${count}">
                      ${count}개
                    </button>
                  `,
                )
                .join("")}
            </div>
            <div class="debug-panel__actions">
              <button class="chip-button" data-home-debug-acquire="true">실행</button>
              <button class="ghost-button" data-home-debug-toggle-close="true">닫기</button>
            </div>
          </div>
          ${buildConstellationDebugMarkup(state)}
        </div>
      </div>
    </div>
  `;
}

export function wireHomeDebug(root, store) {
  root.querySelectorAll("[data-home-debug-open]").forEach((button) => {
    button.addEventListener("click", () => {
      store.update((state) => ({
        ...state,
        homeDebugOpen: !state.homeDebugOpen,
        attendanceModalOpen: false,
        avatarModalOpen: false,
        catalogNoticeOpen: false,
      }));
    });
  });

  root.querySelectorAll("[data-home-debug-toggle-close]").forEach((button) => {
    button.addEventListener("click", () => {
      store.update((state) => ({ ...state, homeDebugOpen: false }));
    });
  });

  root.querySelectorAll("[data-home-debug-acquire]").forEach((button) => {
    button.addEventListener("click", () => {
      const starCount = Number(store.getState().homeDebugStarCount ?? 1);
      store.update((state) => ({
        ...state,
        homeDebugOpen: false,
        attendanceModalOpen: false,
        avatarModalOpen: false,
        catalogNoticeOpen: false,
        activeConstellationId: null,
        activeConstellationSource: null,
      }));
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent("miri:prototype-acquire", { detail: { starCount } }));
      });
    });
  });

  root.querySelectorAll("[data-home-debug-star-count]").forEach((button) => {
    button.addEventListener("click", () => {
      const starCount = Number(button.getAttribute("data-home-debug-star-count") ?? 1);
      store.update((state) => ({
        ...state,
        homeDebugStarCount: starCount,
      }));
    });
  });
}
