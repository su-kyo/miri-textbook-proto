const DEFAULT_PREVIEW_ORIGIN = "http://127.0.0.1:8000";

function getProjectRelativePath(pathname) {
  const decodedPath = decodeURIComponent(pathname).replace(/\\/g, "/");
  const marker = "/miri-textbook/";
  const markerIndex = decodedPath.lastIndexOf(marker);

  if (markerIndex === -1) {
    return "";
  }

  return decodedPath.slice(markerIndex + marker.length);
}

export function redirectFileProtocolToPreview({ previewOrigin = DEFAULT_PREVIEW_ORIGIN } = {}) {
  if (window.location.protocol !== "file:") {
    return false;
  }

  const relativePath = getProjectRelativePath(window.location.pathname);
  if (!relativePath) {
    return false;
  }

  const normalizedOrigin = previewOrigin.replace(/\/$/, "");
  const nextUrl = `${normalizedOrigin}/${relativePath}${window.location.search}${window.location.hash}`;
  window.location.replace(nextUrl);
  return true;
}
