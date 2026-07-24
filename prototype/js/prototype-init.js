import { DEFAULT_AVATAR } from "../../shared/js/app-config.js?v=20260724i";
import { redirectFileProtocolToPreview } from "../../shared/js/file-protocol-redirect.js?v=20260724i";
import { consumeHomeRewardPayload, renderPage, startHomePrototypeAcquisition } from "../../shared/js/page-renderer.js?v=20260724i";
import { createPrototypeStore } from "./prototype-state.js?v=20260724i";
import { buildHomeDebugMarkup, wireHomeDebug } from "../debug/home-debug.js?v=20260724i";
import { buildLearningLetterDebugMarkup, wireLearningLetterDebug } from "../debug/learning-letter-debug.js?v=20260724i";
import { wireConstellationDebug } from "../debug/constellation-debug.js?v=20260724i";

if (!redirectFileProtocolToPreview()) {
  const pageId = document.body.dataset.page;

  if (pageId?.startsWith("learning-") || pageId?.startsWith("diagnostic-")) {
    const publishUrl = new URL(`../../publish/${pageId}.html`, window.location.href);
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set("mode", "prototype");
    publishUrl.search = searchParams.toString();
    publishUrl.hash = window.location.hash;
    window.location.replace(publishUrl.href);
  } else {
    const mount = document.querySelector("#app");
    const store = await createPrototypeStore();
    const searchParams = new URLSearchParams(window.location.search);
    const debugModal = searchParams.get("modal");

    if ((pageId === "home" || pageId === "constellations") && debugModal === "avatar") {
      store.update((state) => ({
        ...state,
        avatarModalOpen: true,
        avatarDraft: { ...(state.avatar ?? DEFAULT_AVATAR) },
        avatarPart: state.avatarPart ?? "eye",
      }));
    }

    if ((pageId === "home" || pageId === "constellations") && debugModal === "attendance") {
      store.update((state) => ({
        ...state,
        attendanceModalOpen: true,
      }));
    }

    if (pageId === "home" && debugModal === "diagnostic") {
      store.update((state) => ({
        ...state,
        diagnosticModalOpen: true,
      }));
    }

    function renderDebugPanels({ pageId: currentPageId, state }) {
      if (currentPageId === "home") {
        return buildHomeDebugMarkup(state);
      }

      if (currentPageId === "learning-vocab-letter") {
        return buildLearningLetterDebugMarkup(state);
      }

      return "";
    }

    function attachPrototypeDebugHooks(root, currentPageId) {
      if (currentPageId === "home") {
        root.querySelectorAll(".home-notice").forEach((button) => {
          button.removeAttribute("data-attendance-open");
          button.setAttribute("data-home-debug-open", "true");
          button.setAttribute("aria-label", "디버그 패널 열기");
        });
      }

      if (currentPageId === "learning-vocab-letter") {
        root.querySelectorAll(".lesson-card__eyebrow").forEach((target) => {
          target.setAttribute("data-letter-debug-open", "true");
        });
      }
    }

    async function draw() {
      await renderPage({
        pageId,
        mode: "prototype",
        mount,
        store,
        renderDebugPanels,
        constellationDebugState: store.getState().constellationDebug,
      });

      attachPrototypeDebugHooks(mount, pageId);
      wireHomeDebug(mount, store);
      wireLearningLetterDebug(mount, store);
      wireConstellationDebug(mount, store);
    }

    store.subscribe(async () => {
      await draw();
    });

    await draw();

    if (pageId === "home") {
      const pendingReward = consumeHomeRewardPayload();
      if (pendingReward) {
        startHomePrototypeAcquisition(store, pendingReward.starCount, { source: pendingReward.source });
      }
    }

    window.addEventListener("miri:prototype-acquire", (event) => {
      const starCount = Number(event.detail?.starCount ?? 1);
      startHomePrototypeAcquisition(store, starCount, { source: "debug" });
    });
  }
}
