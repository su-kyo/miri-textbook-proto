import { redirectFileProtocolToPreview } from "./file-protocol-redirect.js?v=20260724i";
import { createViewStore } from "./view-state.js?v=20260724i";
import { prepareInitialState, renderPage } from "./page-renderer.js?v=20260724i";

if (!redirectFileProtocolToPreview()) {
  const mount = document.querySelector("#app");
  const initialState = await prepareInitialState();
  const store = createViewStore(initialState);

  await renderPage({
    pageId: "docs-design-system",
    mode: "docs",
    mount,
    store,
  });
}
