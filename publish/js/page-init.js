import { redirectFileProtocolToPreview } from "../../shared/js/file-protocol-redirect.js?v=20260731c";
import { createViewStore } from "../../shared/js/view-state.js?v=20260731c";
import { prepareInitialState, renderPage } from "../../shared/js/page-renderer.js?v=20260731c";

if (!redirectFileProtocolToPreview()) {
  const mount = document.querySelector("#app");
  const pageId = document.body.dataset.page;
  const initialState = await prepareInitialState();
  const store = createViewStore(initialState);

  await renderPage({
    pageId,
    mode: "publish",
    mount,
    store,
  });
}
