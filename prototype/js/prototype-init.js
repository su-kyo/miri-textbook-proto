import { DEFAULT_AVATAR } from "../../shared/js/app-config.js?v=20260706g";
import { redirectFileProtocolToPreview } from "../../shared/js/file-protocol-redirect.js?v=20260706g";
import { renderPage, startHomePrototypeAcquisition } from "../../shared/js/page-renderer.js?v=20260707a";
import { createPrototypeStore } from "./prototype-state.js";
import { buildHomeDebugMarkup, wireHomeDebug } from "../debug/home-debug.js";
import { buildLearningLetterDebugMarkup, wireLearningLetterDebug } from "../debug/learning-letter-debug.js";
import { wireConstellationDebug } from "../debug/constellation-debug.js";

if (!redirectFileProtocolToPreview()) {
  const pageId = document.body.dataset.page;

  if (pageId?.startsWith("learning-")) {
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

    function renderDebugPanels({ pageId: currentPageId, state }) {
      if (currentPageId === "home") {
        return buildHomeDebugMarkup(state);
      }

      if (currentPageId === "learning-vocab-letter") {
        return buildLearningLetterDebugMarkup(state);
      }

      if (currentPageId === "constellations" && state.homeDebugOpen) {
        return buildHomeDebugMarkup(state);
      }

      return "";
    }

    function attachPrototypeDebugHooks(root, currentPageId) {
      if (currentPageId === "home" || currentPageId === "constellations") {
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

    window.addEventListener("miri:prototype-acquire", () => {
      startHomePrototypeAcquisition(store);
    });
  }
}
