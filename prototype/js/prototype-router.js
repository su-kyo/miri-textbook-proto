import { redirectFileProtocolToPreview } from "../../shared/js/file-protocol-redirect.js";

if (redirectFileProtocolToPreview()) {
  // file:// directly opened by drag & drop should jump to localhost preview
} else {
  const params = new URLSearchParams(window.location.search);
  const page = params.get("page") || "login";
  const target = new URL(`pages/${page}.html`, window.location.href);
  window.location.replace(target.href);
}
