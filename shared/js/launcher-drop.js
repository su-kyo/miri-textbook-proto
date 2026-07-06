const DROP_READY_CLASS = "is-drop-ready";

function decodeFileUri(uri) {
  try {
    return decodeURIComponent(uri.replace(/^file:\/\//, ""));
  } catch {
    return uri.replace(/^file:\/\//, "");
  }
}

function normalizePath(pathname) {
  return pathname.replace(/\\/g, "/");
}

export function resolveDroppedHtmlTarget({ fileName = "", fileText = "", droppedUri = "" } = {}) {
  const normalizedName = String(fileName).trim();
  const normalizedText = String(fileText);
  const normalizedUri = normalizePath(decodeFileUri(String(droppedUri).trim()));

  if (normalizedUri.includes("/prototype/index.html") || normalizedText.includes('src="prototype/js/prototype-router.js"')) {
    return "prototype/index.html";
  }

  if (normalizedUri.includes("/docs/design-system.html")) {
    return "docs/design-system.html";
  }

  if (normalizedUri.endsWith("/index.html") || normalizedText.includes("miri-textbook Preview Launcher")) {
    return "index.html";
  }

  if (normalizedUri.includes("/prototype/pages/") || normalizedText.includes('src="prototype/js/prototype-init.js"')) {
    return `prototype/pages/${normalizedName}`;
  }

  if (normalizedUri.includes("/publish/") || normalizedText.includes('src="publish/js/page-init.js"')) {
    return `publish/${normalizedName}`;
  }

  if (normalizedName === "design-system.html") {
    return "docs/design-system.html";
  }

  if (normalizedName === "index.html") {
    return "index.html";
  }

  return "";
}

async function extractDroppedHtml(event) {
  const items = Array.from(event.dataTransfer?.items ?? []);
  const htmlItem = items.find((item) => item.kind === "file" && item.type === "text/html");
  const file = htmlItem?.getAsFile?.() ?? Array.from(event.dataTransfer?.files ?? []).find((entry) => entry.type === "text/html");

  if (!file) {
    return null;
  }

  const uriList = event.dataTransfer?.getData("text/uri-list") ?? "";
  const droppedUri = uriList
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("file://")) ?? "";

  const fileText = await file.text();
  return {
    fileName: file.name,
    fileText,
    droppedUri,
  };
}

function setDropStatus(root, message, isError = false) {
  const status = root.querySelector("[data-launcher-drop-status]");
  if (!status) {
    return;
  }

  status.textContent = message;
  status.dataset.state = isError ? "error" : "idle";
}

function setDropReady(root, enabled) {
  root.classList.toggle(DROP_READY_CLASS, enabled);
}

export function initLauncherDrop(root = document) {
  const shell = root.querySelector("[data-launcher-drop-root]");
  if (!shell) {
    return;
  }

  let dragDepth = 0;

  window.addEventListener("dragenter", (event) => {
    if (!event.dataTransfer?.types?.includes("Files")) {
      return;
    }

    dragDepth += 1;
    setDropReady(shell, true);
  });

  window.addEventListener("dragover", (event) => {
    if (!event.dataTransfer?.types?.includes("Files")) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  });

  window.addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      setDropReady(shell, false);
    }
  });

  window.addEventListener("drop", async (event) => {
    if (!event.dataTransfer?.types?.includes("Files")) {
      return;
    }

    event.preventDefault();
    dragDepth = 0;
    setDropReady(shell, false);
    setDropStatus(shell, "파일을 확인하는 중입니다…");

    const dropped = await extractDroppedHtml(event);
    if (!dropped) {
      setDropStatus(shell, "HTML 파일만 열 수 있습니다.", true);
      return;
    }

    const target = resolveDroppedHtmlTarget(dropped);
    if (!target) {
      setDropStatus(shell, "이 프로젝트의 HTML 파일인지 확인할 수 없습니다.", true);
      return;
    }

    setDropStatus(shell, `${dropped.fileName} 열기로 이동합니다…`);
    window.location.href = target;
  });
}
