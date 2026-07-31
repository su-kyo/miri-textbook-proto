import { DEFAULT_AVATAR } from "../../shared/js/app-config.js?v=20260731a";
import { redirectFileProtocolToPreview } from "../../shared/js/file-protocol-redirect.js?v=20260731a";
import { consumeHomeRewardPayload, renderPage, startHomePrototypeAcquisition } from "../../shared/js/page-renderer.js?v=20260731a";
import { createPrototypeStore } from "./prototype-state.js?v=20260731a";
import { buildHomeDebugMarkup, wireHomeDebug } from "../debug/home-debug.js?v=20260731a";
import { wireConstellationDebug } from "../debug/constellation-debug.js?v=20260731a";

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
    }

    async function draw() {
      await renderPage({
        pageId,
        mode: "prototype",
        mount,
        store,
        renderDebugPanels,
      });

      attachPrototypeDebugHooks(mount, pageId);
      wireHomeDebug(mount, store);
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
