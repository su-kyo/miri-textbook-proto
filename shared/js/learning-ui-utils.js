// 학습 화면(publish/prototype)에서 함께 쓰는 순수 표시용 헬퍼 모음.
// 화면별로 갈라져야 하는 라우팅/테마 진입 로직은 각 init 파일에 그대로 둡니다.

export const TAP_ICON = `
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M6.6 1.4C6.6 0.9 6.95 0.5 7.45 0.5C7.95 0.5 8.3 0.9 8.3 1.4V7.05L9.05 6.3C9.4 5.95 9.95 5.95 10.3 6.3C10.65 6.65 10.65 7.2 10.3 7.55L7.95 9.9C7.6 10.25 7.05 10.25 6.7 9.9L4.35 7.55C4 7.2 4 6.65 4.35 6.3C4.7 5.95 5.25 5.95 5.6 6.3L6.6 7.3V1.4Z" fill="currentColor"/>
    <path d="M3 10.1C3 9.6 3.4 9.2 3.9 9.2C4.4 9.2 4.8 9.6 4.8 10.1V10.55C4.8 11.5 5.55 12.25 6.5 12.25H9.5C10.45 12.25 11.2 11.5 11.2 10.55V10.1C11.2 9.6 11.6 9.2 12.1 9.2C12.6 9.2 13 9.6 13 10.1V10.55C13 12.5 11.45 14.05 9.5 14.05H6.5C4.55 14.05 3 12.5 3 10.55V10.1Z" fill="currentColor"/>
  </svg>
`;

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatCurriculum(lesson) {
  return `${lesson.grade}학년 ${lesson.semester}학기 ${lesson.round}회차 [${lesson.subject}]`;
}

export function formatStrokeCount(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return String(value).endsWith("획") ? String(value) : `${value}획`;
}

export function hasDisplayValue(value) {
  return value !== null && value !== undefined && value !== "";
}

export function highlightMeaningSound(text = "") {
  const parts = String(text).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return "";
  }

  if (parts.length === 1) {
    return `<strong>${escapeHtml(parts[0])}</strong>`;
  }

  const last = escapeHtml(parts.pop());
  return `${escapeHtml(parts.join(" "))} <strong>${last}</strong>`;
}

export function isLongText(text) {
  return String(text).length > 34;
}

export function setTheme(theme) {
  document.body.classList.toggle("theme-light", theme === "light");
  document.body.classList.toggle("theme-dark", theme === "dark");
  const toggle = document.querySelector("[data-theme-toggle]");
  if (toggle) {
    toggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  }
}

export function hrefWithTheme(path) {
  if (!document.body.classList.contains("theme-dark")) {
    return path;
  }

  return `${path}${path.includes("?") ? "&" : "?"}theme=dark`;
}

// 예문에서 표제어를 찾기 위한 활용형 후보. 긴 후보부터 매칭해야 "설계하는"이
// "설계하"보다 먼저 잡힙니다.
function buildHighlightCandidates(word = "") {
  const candidates = new Set();
  if (!word) {
    return [];
  }

  candidates.add(word);

  if (word.endsWith("하다")) {
    const stem = word.slice(0, -2);
    [stem, `${stem}해`, `${stem}했`, `${stem}할`, `${stem}한`, `${stem}하면`, `${stem}하며`, `${stem}하게`, `${stem}해서`, `${stem}하여`, `${stem}하는`].forEach((item) =>
      candidates.add(item),
    );
  }

  if (word.endsWith("되다")) {
    const stem = word.slice(0, -2);
    [stem, `${stem}돼`, `${stem}된`, `${stem}될`, `${stem}되면`, `${stem}되어`, `${stem}되는`].forEach((item) => candidates.add(item));
  }

  if (word.endsWith("우다")) {
    const stem = word.slice(0, -2);
    [stem, `${stem}워`, `${stem}웠`, `${stem}우`, `${stem}운`, `${stem}울`, `${stem}우니`, `${stem}워서`].forEach((item) => candidates.add(item));
  }

  return [...candidates].filter(Boolean).sort((left, right) => right.length - left.length);
}

// tag 옵션은 두 화면의 기존 마크업(publish=span, prototype=strong)을 그대로 유지하기
// 위한 것입니다. 마크업을 통일하기로 정하면 이 옵션을 없애면 됩니다.
export function highlightExample(text = "", word = "", { tag = "span" } = {}) {
  const raw = String(text);
  const candidates = buildHighlightCandidates(word);

  for (const candidate of candidates) {
    const index = raw.indexOf(candidate);
    if (index === -1) {
      continue;
    }

    const before = raw.slice(0, index);
    const match = raw.slice(index, index + candidate.length);
    const after = raw.slice(index + candidate.length);
    return `${escapeHtml(before)}<${tag} class="word-card__emphasis">${escapeHtml(match)}</${tag}>${escapeHtml(after)}`;
  }

  return escapeHtml(raw);
}
