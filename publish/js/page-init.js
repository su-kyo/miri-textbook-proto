import { redirectFileProtocolToPreview } from "../../shared/js/file-protocol-redirect.js";
import { createViewStore } from "../../shared/js/view-state.js";
import { prepareInitialState, renderPage } from "../../shared/js/page-renderer.js";

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
