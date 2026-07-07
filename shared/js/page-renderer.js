import { DEFAULT_AVATAR, HOME_PROFILE, NAV_ITEMS, PAGE_TITLES } from "./app-config.js?v=20260706b";
import {
  buildConstellationCatalogCards,
  buildHomeConstellationCards,
  getConstellationById,
  getInitialHomeConstellations,
  loadConstellationCatalog,
} from "./constellation-adapter.js?v=20260707a";
import { buildAvatarMarkup, getAvatarPreviewAssetPath } from "./avatar-utils.js?v=20260706b";
import { resolveProjectUrl } from "./data-loader.js?v=20260707a";
import {
  getHanjaCharacterRows,
  getLearningProgress,
  getLessonMeta,
  getPageActivity,
  getPassageClozeModel,
  getPassageMcQuestions,
  getPassageOxQuestions,
  getVocabCardDeck,
  getVocabLetterSet,
  getVocabMatchingPairs,
  getVocabMeaningQuestions,
  getWordById,
} from "./learning-adapter.js?v=20260706b";
import { vibrate } from "./haptics.js?v=20260706b";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function routePrefix(mode) {
  if (mode === "prototype") {
    return "prototype/pages/";
  }

  if (mode === "publish") {
    return "publish/";
  }

  return "";
}

function pageHref(mode, pageId) {
  return `${routePrefix(mode)}${pageId}.html`;
}

function safeImageAttributes() {
  return `loading="lazy" onerror="this.style.opacity='0';this.style.pointerEvents='none';"`;
}

const FLOW_TIMER_KEYS = [
  "toast-charge",
  "charge-complete",
  "card-front",
];

const flowTimers = new Map();

const DEFAULT_HOME_LESSON_ROWS = [
  { grade: 2, semester: 1, round: 1, subject: "국어" },
  { grade: 2, semester: 1, round: 2, subject: "사회" },
  { grade: 2, semester: 1, round: 2, subject: "과학" },
];

function clearFlowTimer(key) {
  const timer = flowTimers.get(key);
  if (timer) {
    window.clearTimeout(timer);
    flowTimers.delete(key);
  }
}

function clearFlowTimers() {
  FLOW_TIMER_KEYS.forEach(clearFlowTimer);
}

function setFlowTimer(key, callback, delay) {
  clearFlowTimer(key);
  const timer = window.setTimeout(() => {
    flowTimers.delete(key);
    callback();
  }, delay);
  flowTimers.set(key, timer);
}

function formatHomeLessonLabel(lesson) {
  if (!lesson) {
    return "";
  }

  return `${lesson.grade}학년 ${lesson.semester}학기 ${lesson.round}회차 ${lesson.subject}`;
}

async function pickReplacementConstellationId(currentIds = [], lockedIds = []) {
  const catalog = await loadConstellationCatalog();
  const blocked = new Set([...currentIds, ...lockedIds].filter(Boolean));
  const pool = catalog.filter((item) => !blocked.has(item.id));

  if (!pool.length) {
    return catalog.find((item) => !currentIds.includes(item.id))?.id ?? catalog[0]?.id ?? null;
  }

  return pool[Math.floor(Math.random() * pool.length)]?.id ?? null;
}

function buildNoticeIcon() {
  return `
    <svg class="home-notice__icon" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path
        d="M24.8002 27.9996V29.5996C24.8002 30.8726 24.2945 32.0935 23.3943 32.9937C22.4941 33.8939 21.2732 34.3996 20.0002 34.3996C18.7272 34.3996 17.5063 33.8939 16.6061 32.9937C15.7059 32.0935 15.2002 30.8726 15.2002 29.5996V27.9996M24.8002 27.9996H15.2002M24.8002 27.9996H30.5442C31.157 27.9996 31.4642 27.9996 31.7122 27.9164C31.9455 27.8374 32.1574 27.7057 32.3314 27.5314C32.5054 27.3571 32.6368 27.145 32.7154 26.9116C32.8002 26.662 32.8002 26.3548 32.8002 25.7372C32.8002 25.4668 32.8002 25.3324 32.7778 25.2028C32.7383 24.9605 32.6436 24.7306 32.501 24.5308C32.4242 24.4236 32.3282 24.3276 32.1378 24.1372L31.5138 23.5132C31.4143 23.4136 31.3354 23.2953 31.2815 23.1652C31.2277 23.0351 31.2001 22.8956 31.2002 22.7548V16.7996C31.2002 15.3288 30.9105 13.8724 30.3476 12.5136C29.7848 11.1547 28.9598 9.92003 27.9198 8.88001C26.8798 7.84 25.6451 7.01501 24.2863 6.45216C22.9274 5.88931 21.471 5.59961 20.0002 5.59961C18.5294 5.59961 17.073 5.88931 15.7141 6.45216C14.3553 7.01501 13.1206 7.84 12.0806 8.88001C11.0406 9.92003 10.2156 11.1547 9.65274 12.5136C9.08989 13.8724 8.8002 15.3288 8.8002 16.7996V22.7548C8.8003 22.8956 8.77265 23.0351 8.71884 23.1652C8.66503 23.2953 8.58612 23.4136 8.4866 23.5132L7.8626 24.1372C7.6706 24.3292 7.5762 24.4236 7.501 24.5292C7.35704 24.7292 7.26122 24.9597 7.221 25.2028C7.2002 25.3308 7.2002 25.4668 7.2002 25.7372C7.2002 26.3548 7.2002 26.662 7.2834 26.9116C7.36233 27.1453 7.49424 27.3577 7.66882 27.532C7.84341 27.7063 8.05593 27.8378 8.2898 27.9164C8.5378 27.9996 8.8434 27.9996 9.4562 27.9996H15.2002"
        stroke="white"
        stroke-width="3.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `;
}

const AVATAR_THEME_LABELS = {
  green: "초록",
  pink: "분홍",
  blue: "파랑",
};

const AVATAR_PART_LABELS = {
  head: "머리",
  forehead: "마크",
  eye: "눈",
  mouth: "입",
};

function buildAvatarOptionGridMarkup(part, draft) {
  const optionKeys = ["head", "forehead", "eye", "mouth"];
  const previewPart = optionKeys.includes(part) ? part : "eye";

  return Array.from({ length: 6 }, (_, index) => {
    const previewPath = resolveProjectUrl(getAvatarPreviewAssetPath(previewPart, index));
    const selected = draft[previewPart] === index ? "is-selected" : "";
    return `
      <button class="avatar-option ${selected}" type="button" data-avatar-option="${previewPart}:${index}">
        <img src="${previewPath}" alt="" ${safeImageAttributes()} />
      </button>
    `;
  }).join("");
}

function buildNav(pageId, mode) {
  if (pageId === "login" || pageId === "docs-design-system") {
    return "";
  }

  return `
    <nav class="page-bottom-nav app-tabbar">
      <div class="app-tabbar__inner">
      ${NAV_ITEMS.map((item) => {
        const activeClass = item.id === pageId ? "is-active" : "";
        const href = pageHref(mode, item.id);
        return `
          <a class="bottom-nav-link ${activeClass}" href="${href}">
            <img class="bottom-nav-link__icon" src="${resolveProjectUrl(item.icon)}" alt="" />
            <span>${item.label}</span>
          </a>
        `;
      }).join("")}
      </div>
    </nav>
  `;
}

function buildTopBar(pageId, mode, lesson, state) {
  if (pageId === "login") {
    return `
      <header class="page-topbar">
        <div class="logo-mark">미리교과서</div>
      </header>
    `;
  }

  if (["home", "constellations", "records", "ranking", "my"].includes(pageId)) {
    return `
      <header class="home-header">
        <div class="home-topbar">
          <button class="home-profile" type="button" data-avatar-open="true">
            <span class="home-profile__avatar">${state.avatarButtonMarkup ?? ""}</span>
            <span class="home-profile__copy">
              <strong>${HOME_PROFILE.gradeLabel} ${HOME_PROFILE.studentName}</strong>
              <span>${HOME_PROFILE.schoolName}</span>
            </span>
          </button>
          <button class="home-notice" type="button" data-attendance-open="true" aria-label="연속 출석 정보 열기">
            ${buildNoticeIcon()}
            <span class="home-notice__badge">1</span>
          </button>
        </div>
      </header>
    `;
  }

  return `
    <header class="page-topbar">
      <a class="icon-button icon-button--clear" href="${pageHref(mode, "home")}">
        <img src="${resolveProjectUrl("asset/icons/common/back.svg")}" alt="" />
      </a>
      <div class="page-topbar__title">${PAGE_TITLES[pageId]}</div>
      <div style="width:36px"></div>
    </header>
  `;
}

function buildProgress(progress) {
  return `<div class="progress-row">${progress.map((item) => `<span class="progress-pill ${item.active ? "is-active" : ""}"></span>`).join("")}</div>`;
}

function buildLessonMetaCard(lesson, title, instruction, progress) {
  return `
    <section class="lesson-card">
      <div class="lesson-card__eyebrow">
        ${lesson.grade}학년 ${lesson.semester}학기 ${lesson.round}회차
      </div>
      <div class="lesson-card__title">${escapeHtml(title)}</div>
      ${progress}
      <div class="lesson-card__subtitle">${escapeHtml(instruction)}</div>
    </section>
  `;
}

function buildHomeConstellation(card) {
  const previewAsset = card.completed || card.phase === "completed"
    ? card.illustration ?? card.asset
    : card.hidden ?? card.asset;
  const phaseClass = card.phase ? `is-${card.phase}` : "";
  const chargeMarkup =
    card.phase === "charging"
      ? `<span class="home-constellation__charge" aria-hidden="true"><span class="home-constellation__charge-star">★</span></span>`
      : "";

  return `
    <button class="home-constellation home-constellation-slot ${card.completed ? "is-complete" : "is-locked"} ${phaseClass}" type="button" ${card.completed ? `data-constellation-open="${card.id}"` : ""} data-constellation-id="${card.id}">
      <span class="constellation-blend-surface home-constellation__media" aria-hidden="true">
        <img class="home-constellation__image" src="${resolveProjectUrl(previewAsset)}" alt="" ${safeImageAttributes()} />
      </span>
      <div class="home-constellation__progress home-progress-badge">
        <img class="home-constellation__progress-icon" src="${resolveProjectUrl("asset/icons/constellation/progress-star.svg")}" alt="" />
        <div class="home-constellation__segments">
          ${card.progressSegments.map((segment) => `<span class="home-constellation__segment ${segment.active ? "is-active" : ""}"></span>`).join("")}
        </div>
      </div>
      ${chargeMarkup}
    </button>
  `;
}

function buildCatalogConstellation(card) {
  const previewAsset = card.completed || card.phase === "completed"
    ? card.illustration ?? card.asset
    : card.hidden ?? card.asset;
  return `
    <button class="catalog-card ${card.completed ? "is-complete" : "is-locked"}" type="button" ${card.completed ? `data-constellation-open="${card.id}"` : ""}>
      <div class="catalog-card__frame">
        ${
          card.completed
            ? `
              <span class="constellation-blend-surface catalog-card__media" aria-hidden="true">
                <img class="catalog-card__image" src="${resolveProjectUrl(previewAsset)}" alt="" ${safeImageAttributes()} />
              </span>
            `
            : ""
        }
        ${card.completed ? "" : `<img class="catalog-card__lock" src="${resolveProjectUrl("asset/icons/constellation/slot-lock.svg")}" alt="" />`}
      </div>
      ${card.completed ? `<div class="catalog-card__chip">${escapeHtml(card.nameKo)}</div>` : ""}
      ${card.duplicateCount > 1 ? `<span class="catalog-card__badge">×${card.duplicateCount}</span>` : ""}
    </button>
  `;
}

function buildHanjaModal(word) {
  if (!word) {
    return "";
  }

  const characters = getHanjaCharacterRows(word);
  const formatStrokeCount = (value) => {
    if (value === null || value === undefined || value === "") {
      return "";
    }

    return String(value).endsWith("획") ? String(value) : `${value}획`;
  };
  return `
    <div class="modal-layer fade-in">
      <div class="modal-backdrop" data-modal-close="hanja"></div>
      <div class="modal-card slide-up">
        <div class="modal-card__header">
          <div class="modal-card__title">한자 상세</div>
          <button class="icon-button icon-button--clear" data-modal-close="hanja">×</button>
        </div>
        <div class="modal-card__body">
          <div class="data-card">
            <div class="data-card__title" style="text-align:center;">${escapeHtml(word.word)}</div>
          </div>
          ${characters
            .map(
              (character) => `
                <div class="hanja-group">
                  <div>
                    <div class="hanja-group__glyph">${escapeHtml(character.char)}</div>
                    <div class="hanja-group__sound">${escapeHtml(character.meaningSound)}</div>
                  </div>
                  <div class="hanja-group__meta">
                    <div class="hanja-group__meta-row"><span>부수</span><strong>${escapeHtml(character.radical)}</strong></div>
                    <div class="hanja-group__meta-row"><span>총 획수</span><strong>${escapeHtml(formatStrokeCount(character.totalStrokes))}</strong></div>
                    <div class="hanja-group__meta-row"><span>부수 외 획수</span><strong>${escapeHtml(formatStrokeCount(character.strokesExceptRadical))}</strong></div>
                  </div>
                </div>
              `,
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function buildAvatarModal(state) {
  if (!state.avatarModalOpen) {
    return "";
  }

  const avatar = state.avatarDraftMarkup ?? state.avatarMarkup ?? "";
  const draft = { ...DEFAULT_AVATAR, ...(state.avatarDraft ?? state.avatar ?? DEFAULT_AVATAR) };
  const part = state.avatarPart ?? "eye";
  const optionButtons = buildAvatarOptionGridMarkup(part, draft);

  return `
    <div class="modal-layer fade-in">
      <div class="modal-backdrop" data-modal-close="avatar"></div>
      <div class="modal-card modal-card--home slide-up">
        <div class="modal-card__header modal-card__header--home">
          <div class="modal-card__title modal-card__title--home">아바타 꾸미기</div>
          <button class="icon-button icon-button--clear" data-modal-close="avatar">×</button>
        </div>
        <div class="modal-card__body modal-card__body--home">
          <div class="avatar-editor">
            <div class="avatar-editor__preview">${avatar}</div>
            <div class="avatar-editor__panel">
              <div class="avatar-editor__section">
                <div class="avatar-editor__label">색깔</div>
                <div class="avatar-theme-grid">
                  ${Object.entries(AVATAR_THEME_LABELS)
                    .map(
                      ([theme, label]) => `
                        <button class="avatar-theme-button ${draft.theme === theme ? "is-selected" : ""}" type="button" data-avatar-theme="${theme}">
                          <span class="avatar-theme-button__dot avatar-theme-button__dot--${theme}"></span>
                          <span>${label}</span>
                        </button>
                      `,
                    )
                    .join("")}
                </div>
              </div>
              <div class="avatar-editor__section">
                <div class="avatar-editor__label">꾸미기 항목</div>
                <div class="avatar-part-grid">
                  ${Object.entries(AVATAR_PART_LABELS)
                    .map(
                      ([key, label]) => `
                        <button class="avatar-part-button ${part === key ? "is-selected" : ""}" type="button" data-avatar-part="${key}">
                          ${label}
                        </button>
                      `,
                    )
                    .join("")}
                </div>
              </div>
              <div class="avatar-editor__section">
                <div class="avatar-editor__label">옵션</div>
                <div class="avatar-option-grid">
                  ${optionButtons}
                </div>
              </div>
            </div>
            <div class="avatar-editor__footer">
              <button class="avatar-editor__action avatar-editor__action--ghost" type="button" data-avatar-cancel="true">취소</button>
              <button class="avatar-editor__action avatar-editor__action--primary" type="button" data-avatar-save="true">저장</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildAttendanceModal(state) {
  if (!state.attendanceModalOpen) {
    return "";
  }

  const weekdays = [
    ["일", "is-sun"],
    ["월", ""],
    ["화", ""],
    ["수", ""],
    ["목", ""],
    ["금", ""],
    ["토", "is-sat"],
  ];
  const cells = [
    ["", "", ""],
    ["1", "", ""],
    ["2", "is-active is-range-start", ""],
    ["3", "is-active", ""],
    ["4", "is-active is-range-end", "star-yellow"],
    ["5", "", ""],
    ["6", "", ""],
    ["7", "is-sun", ""],
    ["8", "is-active is-pill", ""],
    ["9", "", ""],
    ["10", "", ""],
    ["11", "", ""],
    ["12", "is-active is-range-start", ""],
    ["13", "is-active", ""],
    ["14", "is-active is-sun", "star-yellow"],
    ["15", "is-active", ""],
    ["16", "is-active", "star-pink"],
    ["17", "is-active", ""],
    ["18", "is-active is-range-end", "star-blue"],
    ["19", "is-disabled", ""],
    ["20", "is-disabled", ""],
    ["21", "is-disabled is-sun", ""],
    ["22", "is-disabled", ""],
    ["23", "is-disabled", ""],
    ["24", "is-disabled", ""],
    ["25", "is-disabled", ""],
    ["26", "is-disabled", ""],
    ["27", "is-disabled", ""],
    ["28", "is-disabled is-sun", ""],
    ["29", "is-disabled", ""],
    ["30", "is-disabled", ""],
  ];

  return `
    <div class="modal-layer fade-in">
      <div class="modal-backdrop" data-modal-close="attendance"></div>
      <div class="modal-card modal-card--home slide-up">
        <div class="modal-card__header modal-card__header--home">
          <div class="modal-card__title modal-card__title--home">출석 현황</div>
          <button class="icon-button icon-button--clear" data-modal-close="attendance">×</button>
        </div>
        <div class="modal-card__body modal-card__body--home">
          <div class="attendance-modal">
            <div class="attendance-modal__toolbar">
              <div class="attendance-modal__month">
                <button class="attendance-modal__nav" type="button">‹</button>
                <strong>2026년 6월</strong>
                <button class="attendance-modal__nav" type="button">›</button>
              </div>
              <div class="attendance-modal__streak"><strong>${state.streakDays}일</strong><span>연속</span></div>
            </div>
            <div class="attendance-modal__calendar">
              <div class="attendance-modal__weekdays">
                ${weekdays
                  .map(
                    ([label, className]) => `<div class="attendance-modal__weekday ${className}">${label}</div>`,
                  )
                  .join("")}
              </div>
              <div class="attendance-modal__days">
                ${cells
                  .map(([label, className, marker]) => {
                    if (!label) {
                      return `<div class="attendance-modal__day is-empty"></div>`;
                    }

                    const markerPath =
                      marker === "star-yellow"
                        ? "asset/icons/home/streak-star-3.svg"
                        : marker === "star-pink"
                          ? "asset/icons/home/streak-star-5.svg"
                          : marker === "star-blue"
                            ? "asset/icons/home/streak-star-7.svg"
                            : "";

                    return `
                      <div class="attendance-modal__day ${className}">
                        <span>${label}</span>
                        ${
                          markerPath
                            ? `<img class="attendance-modal__marker ${marker}" src="${resolveProjectUrl(markerPath)}" alt="" />`
                            : ""
                        }
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            </div>
            <div class="attendance-modal__reward">
              <strong>연속 출석 보상</strong>
              <div class="attendance-modal__reward-row">
                <span class="reward-chip reward-chip--lime"><img src="${resolveProjectUrl("asset/icons/home/streak-star-3.svg")}" alt="" />3일 +10점</span>
                <span class="reward-chip reward-chip--pink"><img src="${resolveProjectUrl("asset/icons/home/streak-star-5.svg")}" alt="" />5일 +30점</span>
                <span class="reward-chip reward-chip--blue"><img src="${resolveProjectUrl("asset/icons/home/streak-star-7.svg")}" alt="" />7일 +50점</span>
              </div>
              <p>7일마다 새로 시작</p>
            </div>
            <button class="attendance-modal__confirm" type="button" data-modal-close="attendance">확인</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildConstellationOverlay(card, state = {}) {
  if (!card) {
    return "";
  }

  const isAcquirePreview = state.pendingReplacementSlotId === card.id && state.acquisitionState === "card-front-visible";
  const showAcquireActions = isAcquirePreview && state.acquisitionState === "card-front-visible";
  const showCloseButton = !isAcquirePreview;
  const imageSrc = isAcquirePreview
    ? card.illustration ?? card.asset ?? card.hidden
    : card.completed
      ? card.illustration ?? card.asset ?? card.hidden
      : card.hidden ?? card.asset;
  const modalLayerClass = isAcquirePreview ? "modal-layer" : "modal-layer fade-in";
  const overlayCardClass = "overlay-card";

  return `
    <div class="${modalLayerClass}">
      <div class="modal-backdrop" data-modal-close="constellation"></div>
      <div class="${overlayCardClass}">
        <div class="constellation-overlay">
          ${showCloseButton ? `<button class="constellation-overlay__close" data-modal-close="constellation">×</button>` : ""}
          <div class="constellation-card">
            <div class="constellation-card__inner">
              <div class="constellation-card-front constellation-overlay__card">
                <img class="constellation-overlay__frame" src="${resolveProjectUrl("asset/ui/constellation/card-front.png")}" alt="" />
                ${card.duplicateCount > 1 ? `<span class="constellation-overlay__badge">×${card.duplicateCount}</span>` : ""}
                <img class="constellation-overlay__image" src="${resolveProjectUrl(imageSrc)}" alt="" ${safeImageAttributes()} />
                <div class="constellation-overlay__title">${escapeHtml(card.nameKo)}</div>
                <div class="constellation-overlay__copy">
                  <div class="constellation-overlay__tagline">${escapeHtml(card.tagline ?? "")}</div>
                  <div class="constellation-overlay__description">
                    <div class="constellation-overlay__description-scroll">${escapeHtml(card.description ?? "")}</div>
                  </div>
                </div>
                ${
                  showAcquireActions
                    ? `
                        <div class="constellation-overlay__acquire-actions">
                          <button class="constellation-overlay__receive-button" type="button" data-modal-close="constellation">카드 받기</button>
                          <p class="constellation-overlay__acquire-caption">별자리 도감에서 확인할 수 있어요!</p>
                        </div>
                      `
                    : ""
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildBottomSheet(blank, active) {
  if (!blank || !active) {
    return "";
  }

  return `
    <div class="bottom-sheet-layer fade-in">
      <div class="sheet-backdrop" data-sheet-close="cloze"></div>
      <div class="sheet-card slide-up">
        <div class="sheet-card__header">
          <div class="sheet-card__title">선택지</div>
          <button class="icon-button icon-button--clear" data-sheet-close="cloze">×</button>
        </div>
        <div class="sheet-card__body">
          ${blank.options.map((option) => `<button class="option-card" data-cloze-option="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join("")}
        </div>
      </div>
    </div>
  `;
}

function buildHomeHeaderStats(state) {
  return `
    <section class="home-stats">
      <div class="home-chip home-chip--score">오늘 ${state.todayScore}점</div>
      <div class="home-stats__attendance">
        <button class="home-chip home-chip--streak" type="button" data-attendance-open="true" aria-label="연속 출석 정보 열기">
          <span>연속 출석</span>
          <img class="home-chip__fire" src="${resolveProjectUrl("asset/icons/home/streak.svg")}" alt="" />
          <strong>${state.streakDays}일</strong>
        </button>
        <button class="home-attendance__info" type="button" data-attendance-open="true" aria-label="출석 정보">
          <img src="${resolveProjectUrl("asset/icons/common/info-circle.svg")}" alt="" />
        </button>
      </div>
    </section>
  `;
}

function buildConstellationField(cards) {
  return `
    <section class="home-constellation-field">
      <div class="home-constellation-field__grid">
        ${cards.map((card) => buildHomeConstellation(card)).join("")}
      </div>
    </section>
  `;
}

function buildStudyCard(mode, state) {
  const rows = state.homeLessonRows?.length ? state.homeLessonRows : DEFAULT_HOME_LESSON_ROWS;
  const currentRow = rows[0] ?? DEFAULT_HOME_LESSON_ROWS[0];
  const nextRow = rows[1] ?? DEFAULT_HOME_LESSON_ROWS[1];
  const learningStartHref = pageHref(mode, "learning-vocab-card");
  const resultHref = `${pageHref(mode, "learning-result")}?from=home`;

  return `
    <section class="study-panel">
      <div class="study-panel__header">
        <img src="${resolveProjectUrl("asset/icons/constellation/progress-star.svg")}" alt="" />
        <span>오늘의 학습</span>
      </div>
      <div class="study-panel__rows">
        <a class="study-panel__row" href="${resultHref}">
          <div class="study-panel__lesson">
            <strong>${escapeHtml(formatHomeLessonLabel(currentRow))}</strong>
          </div>
          <div class="study-panel__score">
            <span>${state.learningScore ?? "42점"}</span>
            <i>›</i>
          </div>
        </a>
        <a class="study-panel__row is-action" href="${learningStartHref}">
          <div class="study-panel__lesson">
            <strong>${escapeHtml(formatHomeLessonLabel(nextRow))}</strong>
          </div>
          <span class="study-panel__cta">시작하기</span>
        </a>
      </div>
    </section>
  `;
}

function statefulScore(lesson) {
  return `${Math.max(lesson.round * 10, 0)}점`;
}

function resolveConstellationDebugState(constellationDebugState) {
  return constellationDebugState ?? { mode: "default", percent: 35, acquiredIds: [] };
}

function buildHomeBody(lesson, cards, mode, state) {
  return `
    <div class="home-content">
      ${buildHomeHeaderStats({ todayScore: state.todayScore, streakDays: state.streakDays })}
      ${buildStudyCard(mode, state)}
      ${buildConstellationField(cards)}
    </div>
  `;
}

function flowLabel(flowKey) {
  const map = {
    vocabCard: "단어 카드",
    vocabMatching: "짝맞추기",
    vocabLetter: "글자 맞추기",
    vocabMeaningMc: "어휘 객관식",
    passageCloze: "지문 읽기",
    passageOx: "OX",
    passageMc: "지문 객관식",
    complete: "학습 완료",
  };
  return map[flowKey] ?? flowKey;
}

function flowKeyToPage(flowKey) {
  const map = {
    vocabCard: "learning-vocab-card",
    vocabMatching: "learning-vocab-matching",
    vocabLetter: "learning-vocab-letter",
    vocabMeaningMc: "learning-vocab-mc",
    passageCloze: "learning-passage-cloze",
    passageOx: "learning-passage-ox",
    passageMc: "learning-passage-mc",
    complete: "learning-complete",
  };
  return map[flowKey] ?? "home";
}

const LEARNING_NEXT_PAGE = {
  "learning-vocab-card": "learning-vocab-matching",
  "learning-vocab-matching": "learning-vocab-letter",
  "learning-vocab-letter": "learning-vocab-mc",
  "learning-vocab-mc": "learning-passage-cloze",
  "learning-passage-cloze": "learning-passage-ox",
  "learning-passage-ox": "learning-passage-mc",
  "learning-passage-mc": "learning-complete",
};

function buildLearningNextAction(pageId, mode) {
  const nextPage = LEARNING_NEXT_PAGE[pageId];
  if (!nextPage) {
    return "";
  }

  const label = nextPage === "learning-complete" ? "학습 완료" : "다음";
  return `<a class="cta-button" href="${pageHref(mode, nextPage)}">${label}</a>`;
}

async function buildLearningBody(pageId, lesson, state, mode) {
  const activity = await getPageActivity(pageId);
  const progress = buildProgress(await getLearningProgress(pageId));
  const header = buildLessonMetaCard(lesson, activity?.title ?? PAGE_TITLES[pageId], activity?.instruction ?? "", progress);

  if (pageId === "learning-vocab-card") {
    const cards = await getVocabCardDeck();
    const word = cards[0];
    return `${header}
      <section class="word-card">
        ${word?.hasHanja ? `<button class="word-card__info" data-hanja-open="${escapeHtml(word.id)}"><img src="${resolveProjectUrl("asset/icons/common/info-circle.svg")}" alt="" /></button>` : ""}
        <div class="word-card__title">${escapeHtml(word?.word ?? "")}</div>
        ${word?.hanja ? `<div class="word-card__hanja">${escapeHtml(word.hanja)}</div>` : ""}
        <div class="word-card__meaning">${escapeHtml(word?.meaning ?? "")}</div>
        ${(word?.examples ?? []).slice(0, 2).map((example) => `<div class="word-card__example">${escapeHtml(example)}</div>`).join("")}
      </section>
      ${buildLearningNextAction(pageId, mode)}`;
  }

  if (pageId === "learning-vocab-matching") {
    const pairs = await getVocabMatchingPairs();
    return `${header}
      <section class="matching-grid">
        ${pairs
          .flatMap((pair) => [
            `<div class="option-card"><strong>${escapeHtml(pair.word)}</strong></div>`,
            `<div class="option-card">${escapeHtml(pair.meaning)}</div>`,
          ])
          .join("")}
      </section>
      ${buildLearningNextAction(pageId, mode)}`;
  }

  if (pageId === "learning-vocab-letter") {
    const questions = await getVocabLetterSet(state.letterVariant ?? "lowerGrade");
    const question = questions[0];
    return `${header}
      <section class="data-card">
        <div class="data-card__title">${escapeHtml(question?.prompt ?? "")}</div>
        <div class="segment-row" style="margin-top:16px;">
          ${(question?.initials ?? []).map((initial) => `<span class="letter-tile">${escapeHtml(initial)}</span>`).join("")}
        </div>
      </section>
      <section class="letter-grid">
        ${(question?.tiles ?? []).map((tile) => `<button class="letter-tile">${escapeHtml(tile)}</button>`).join("")}
      </section>
      ${buildLearningNextAction(pageId, mode)}`;
  }

  if (pageId === "learning-vocab-mc") {
    const questions = await getVocabMeaningQuestions();
    const question = questions[0];
    return `${header}
      <section class="data-card">
        <div class="data-card__title">${escapeHtml(question?.question ?? "")}</div>
      </section>
      <section class="option-list">
        ${(question?.options ?? []).map((option) => `<button class="option-card">${escapeHtml(option)}</button>`).join("")}
      </section>
      ${buildLearningNextAction(pageId, mode)}`;
  }

  if (pageId === "learning-passage-cloze") {
    const cloze = await getPassageClozeModel();
    const activeBlankId = state.activeBlankId;
    const activeBlank = cloze?.blanks?.find((blank) => blank.id === activeBlankId) ?? null;
    const clozeMap = state.clozeAnswers ?? {};
    return `${header}
      <section class="data-card">
        <div class="passage-title">${escapeHtml(cloze?.passageTitle ?? "")}</div>
        <div class="passage-copy" style="margin-top:16px;">
          ${(cloze?.blocks ?? [])
            .map((block) => {
              if (block.type === "blank") {
                const value = clozeMap[block.id] ?? "";
                return `<button class="blank-button" data-blank-open="${escapeHtml(block.id)}">${escapeHtml(value || "선택")}</button>`;
              }
              return escapeHtml(block.text ?? "").replaceAll("\n", "<br />");
            })
            .join("")}
        </div>
      </section>
      ${buildLearningNextAction(pageId, mode)}
      ${buildBottomSheet(activeBlank, Boolean(activeBlank))}`;
  }

  if (pageId === "learning-passage-ox") {
    const questions = await getPassageOxQuestions();
    const question = questions[0];
    return `${header}
      <section class="data-card">
        <div class="data-card__title">${escapeHtml(question?.statement ?? "")}</div>
      </section>
      <section class="matching-grid">
        <button class="option-card"><img src="${resolveProjectUrl("asset/icons/learning/o.svg")}" alt="" /></button>
        <button class="option-card"><img src="${resolveProjectUrl("asset/icons/learning/x.svg")}" alt="" /></button>
      </section>
      ${buildLearningNextAction(pageId, mode)}`;
  }

  if (pageId === "learning-passage-mc") {
    const questions = await getPassageMcQuestions();
    const question = questions[0];
    return `${header}
      <section class="data-card">
        <div class="data-card__title">${escapeHtml(question?.question ?? "")}</div>
      </section>
      <section class="option-list">
        ${(question?.options ?? []).map((option) => `<button class="option-card">${escapeHtml(option)}</button>`).join("")}
      </section>
      ${buildLearningNextAction(pageId, mode)}`;
  }

  if (pageId === "learning-complete") {
    return `${header}
      <section class="result-card">
        <div class="result-card__title">학습 완료</div>
        <div class="data-card__body">${escapeHtml(lesson.visibleHomeTitle ?? "")}</div>
      </section>
      <a class="cta-button" href="${pageHref(mode, "learning-result")}">결과 보기</a>`;
  }

  if (pageId === "learning-result") {
    return `
      <section class="result-card">
        <div class="result-card__title">${escapeHtml(lesson.visibleHomeTitle ?? "")}</div>
        <div class="info-list" style="margin-top:12px;">
          <div class="option-card"><span>단어 카드</span><strong>10</strong></div>
          <div class="option-card"><span>지문 읽기</span><strong>7</strong></div>
          <div class="option-card"><span>오늘의 별빛</span><strong>+${lesson.round * 10}</strong></div>
        </div>
      </section>
      <a class="cta-button" href="${pageHref(mode, "home")}">다음으로</a>
    `;
  }

  return header;
}

const RECORD_FILTERS = [
  { label: "전체", active: true },
  { label: "국어", active: false },
  { label: "사회", active: false },
  { label: "과학", active: false },
];

const RECORD_GROUPS = [
  {
    date: "7.05 (일)",
    entries: [
      { subject: "과학", subjectClass: "is-science", round: "1회차", score: "84점" },
    ],
  },
  {
    date: "7.04 (토)",
    entries: [
      { subject: "국어", subjectClass: "is-korean", round: "2회차", score: "92점" },
      { subject: "사회", subjectClass: "is-social", round: "2회차", score: "76점" },
    ],
  },
  {
    date: "7.03 (금)",
    entries: [
      { subject: "국어", subjectClass: "is-korean", round: "1회차", score: "71점" },
      { subject: "사회", subjectClass: "is-social", round: "1회차", score: "63점" },
    ],
  },
];

const RANKING_ROWS = [
  { rank: "1", name: "서도윤", school: "한울국어학원", score: "99,998,258점", variant: "is-first", avatar: { theme: "green", head: 2, forehead: 1, eye: 4, mouth: 5 } },
  { rank: "2", name: "민서아", school: "문해력연구소", score: "98,764,520점", variant: "is-second", avatar: { theme: "pink", head: 4, forehead: 2, eye: 1, mouth: 3 } },
  { rank: "3", name: "강하준", school: "새봄국어학원", score: "97,882,430점", variant: "is-third", avatar: { theme: "blue", head: 1, forehead: 4, eye: 0, mouth: 2 } },
  { rank: "4", name: "이서윤", school: "책나래국어학원", score: "96,311,800점", variant: "", avatar: { theme: "green", head: 5, forehead: 0, eye: 2, mouth: 1 } },
  { rank: "5", name: "박도현", school: "늘품독서학원", score: "94,903,770점", variant: "", avatar: { theme: "pink", head: 3, forehead: 5, eye: 3, mouth: 0 } },
  { rank: "6", name: "정유나", school: "글빛국어교실", score: "93,714,250점", variant: "", avatar: { theme: "blue", head: 0, forehead: 3, eye: 5, mouth: 4 } },
  { rank: "7", name: HOME_PROFILE.studentName, school: HOME_PROFILE.schoolName, score: "91,208,330점", variant: "", isMe: true },
  { rank: "8", name: "최지호", school: "라온논술학원", score: "90,882,040점", variant: "", avatar: { theme: "green", head: 1, forehead: 2, eye: 4, mouth: 0 } },
  { rank: "9", name: "한수아", school: "다온국어스튜디오", score: "89,740,110점", variant: "", avatar: { theme: "pink", head: 2, forehead: 4, eye: 2, mouth: 5 } },
  { rank: "10", name: "윤지후", school: "생각나무학원", score: "88,615,420점", variant: "", avatar: { theme: "blue", head: 4, forehead: 1, eye: 1, mouth: 3 } },
  { rank: "11", name: "김채은", school: "한글숲국어교실", score: "87,509,600점", variant: "", avatar: { theme: "green", head: 0, forehead: 5, eye: 3, mouth: 2 } },
  { rank: "12", name: "오시우", school: "문장력연습실", score: "86,940,280점", variant: "", avatar: { theme: "pink", head: 5, forehead: 3, eye: 0, mouth: 4 } },
  { rank: "13", name: "배하린", school: "국어의힘학원", score: "85,774,930점", variant: "", avatar: { theme: "blue", head: 3, forehead: 0, eye: 5, mouth: 1 } },
  { rank: "14", name: "임준서", school: "온글국어센터", score: "84,638,570점", variant: "", avatar: { theme: "green", head: 4, forehead: 4, eye: 2, mouth: 3 } },
  { rank: "15", name: "조아인", school: "해오름독해학원", score: "83,502,210점", variant: "", avatar: { theme: "pink", head: 1, forehead: 0, eye: 4, mouth: 2 } },
];

function buildRecordEntry(entry, mode) {
  return `
    <a class="records-item" href="${pageHref(mode, "learning-result")}?from=records">
      <div class="records-item__left">
        <span class="records-item__subject ${entry.subjectClass}">${escapeHtml(entry.subject)}</span>
        <span class="records-item__round">${escapeHtml(entry.round)}</span>
      </div>
      <span class="records-item__score">
        <span>${escapeHtml(entry.score)}</span>
        <span class="records-item__chevron" aria-hidden="true">›</span>
      </span>
    </a>
  `;
}

function buildRecordsGroup(group, mode) {
  return `
    <section class="records-group">
      <div class="records-group__date">
        <img src="${resolveProjectUrl("asset/icons/home/calendar.svg")}" alt="" />
        <span>${escapeHtml(group.date)}</span>
      </div>
      <div class="records-group__items">
        ${group.entries.map((entry) => buildRecordEntry(entry, mode)).join("")}
      </div>
    </section>
  `;
}

function buildRecordsBody(_lesson, mode) {
  return `
    <div class="simple-shell-page records-page">
      <section class="records-page__header">
        <h1 class="records-page__title">기록</h1>
        <button class="records-page__term" type="button">
          <span>3학년 1학기</span>
          <span class="records-page__term-chevron" aria-hidden="true">⌄</span>
        </button>
      </section>
      <section class="records-summary-card">
        <div class="records-summary-card__title">
          <img class="records-summary-card__star" src="${resolveProjectUrl("asset/ui/decorative/title-star.svg")}" alt="" />
          <span>이번 주 학습 요약</span>
        </div>
        <div class="records-summary-grid">
          <div class="records-summary-item">
            <img class="records-summary-item__icon" src="${resolveProjectUrl("asset/icons/home/calendar.svg")}" alt="" />
            <div class="records-summary-item__copy">
              <span class="records-summary-item__label">이번 주 완료</span>
              <div class="records-summary-item__value"><strong>6</strong>개</div>
            </div>
          </div>
          <div class="records-summary-item">
            <img class="records-summary-item__icon" src="${resolveProjectUrl("asset/icons/home/trophy.svg")}" alt="" />
            <div class="records-summary-item__copy">
              <span class="records-summary-item__label">이번 주 평균</span>
              <div class="records-summary-item__value"><strong>76</strong>점</div>
            </div>
          </div>
        </div>
      </section>
      <section class="records-filter-row">
        ${RECORD_FILTERS.map((filter) => `<button class="records-filter-chip ${filter.active ? "is-active" : ""}" type="button">${filter.label}</button>`).join("")}
      </section>
      ${RECORD_GROUPS.map((group) => buildRecordsGroup(group, mode)).join("")}
    </div>
  `;
}

function buildRankingCard(rank, name, school, score, avatarMarkup, variant = "", isMe = false) {
  return `
    <article class="ranking-card ${variant} ${isMe ? "is-me" : ""}">
      <span class="ranking-card__rank">${rank}</span>
      <div class="ranking-card__profile">
        <span class="ranking-card__avatar">${avatarMarkup}</span>
        <div class="ranking-card__copy">
          <div class="ranking-card__name">${escapeHtml(name)}${isMe ? ' <span class="ranking-card__name-accent">나</span>' : ""}</div>
          <div class="ranking-card__school">${escapeHtml(school)}</div>
        </div>
      </div>
      <span class="ranking-card__score">${escapeHtml(score)}</span>
    </article>
  `;
}

async function buildRankingBody(state) {
  const myRow = RANKING_ROWS.find((row) => row.isMe) ?? RANKING_ROWS[0];
  const rankingCards = await Promise.all(
    RANKING_ROWS.map(async (row) => {
      const avatarMarkup = row.isMe
        ? (state.avatarButtonMarkup ?? (await buildAvatarMarkup(state.avatar ?? DEFAULT_AVATAR, { small: true })))
        : await buildAvatarMarkup(row.avatar ?? DEFAULT_AVATAR, { small: true });
      return buildRankingCard(row.rank, row.name, row.school, row.score, avatarMarkup, row.variant, row.isMe);
    }),
  );

  return `
    <div class="simple-shell-page ranking-page">
      <section class="ranking-page__header">
        <h1 class="ranking-page__title">랭킹</h1>
        <div class="ranking-page__league">전국 3학년 리그</div>
      </section>
      <section class="ranking-summary-card">
        <span class="ranking-summary-card__badge">내 순위</span>
        <div class="ranking-summary-grid">
          <div class="ranking-summary-item">
            <span class="ranking-summary-item__label">현재 순위</span>
            <div class="ranking-summary-item__value"><strong>${escapeHtml(myRow.rank)}</strong>위</div>
          </div>
          <div class="ranking-summary-item">
            <span class="ranking-summary-item__label">획득 점수</span>
            <div class="ranking-summary-item__value">${escapeHtml(myRow.score)}</div>
          </div>
        </div>
      </section>
      <section class="ranking-filter-row">
        <button class="ranking-filter-chip is-active" type="button">주간 랭킹</button>
        <button class="ranking-filter-chip" type="button">누적 랭킹</button>
      </section>
      <section class="ranking-list">
        ${rankingCards.join("")}
      </section>
    </div>
  `;
}

function buildConstellationsBody(cards) {
  return `
    <div class="catalog-content">
      <section class="catalog-heading">
        <span>별자리 도감</span>
      </section>
      <section class="catalog-grid">
        ${cards.map((card) => buildCatalogConstellation(card)).join("")}
      </section>
    </div>
  `;
}

function buildMyBody() {
  return `
    <div class="simple-shell-page my-page">
      <section class="my-page__header">
        <h1 class="my-page__title">마이</h1>
      </section>
      <section class="data-card">
        <div class="data-card__title">내 학습 정보</div>
        <div class="data-card__body">${HOME_PROFILE.gradeLabel} ${HOME_PROFILE.studentName}</div>
      </section>
    </div>
  `;
}

function buildToastLayer(state) {
  if (!state.activeToast) {
    return "";
  }

  return `
    <div class="toast-layer fade-in">
      <div class="home-toast">${escapeHtml(state.activeToast)}</div>
    </div>
  `;
}

function buildLoginBody(mode) {
  const href = pageHref(mode, "home");
  return `
    <section class="lesson-card" style="margin-top:auto; margin-bottom:auto;">
      <div class="lesson-card__eyebrow">매일국어 Lite</div>
      <div class="lesson-card__title">미리교과서</div>
      <div class="lesson-card__subtitle"> </div>
      <a class="cta-button" href="${href}" style="margin-top:20px;">시작하기</a>
    </section>
  `;
}

function buildDocsBody() {
  return `
    <div class="docs-canvas">
      <div class="docs-block">
        <h2>Design System Check</h2>
        <p>0단계 공통 토큰과 퍼블리싱 기준 확인용 페이지입니다. 학생 화면에 들어가지 않는 설명은 이 페이지에서만 노출합니다.</p>
      </div>
      <div class="docs-section-grid" style="margin-top:20px;">
        <div class="docs-block">
          <h3>Color Tokens</h3>
          <div class="token-grid" style="margin-top:16px;">
            ${[
              ["bg", "#080A32"],
              ["surface", "#FAF8FF"],
              ["accent", "#C3ED39"],
              ["accent-strong", "#A9FF52"],
              ["line", "#E0D8F8"],
              ["text-soft", "#6E6A84"],
            ]
              .map(
                ([label, color]) => `
                  <div class="token-card">
                    <div class="token-card__swatch" style="background:${color};"></div>
                    <strong>${label}</strong>
                    <span>${color}</span>
                  </div>
                `,
              )
              .join("")}
          </div>
        </div>
        <div class="docs-block">
          <h3>Typography</h3>
          <p style="font-family:var(--font-display); font-size:24px; color:#111;">쌍둥이자리</p>
          <p style="font-size:20px; color:#111; font-weight:700;">부제목 선택지</p>
          <p style="font-size:18px; color:#111;">버튼 기본 텍스트</p>
          <p style="font-size:16px; color:#6e6a84;">일반 본문 내용</p>
          <p style="font-size:14px; color:#6e6a84; font-weight:800;">3학년 1학기 1회차</p>
        </div>
        <div class="docs-block">
          <h3>Spacing / Radius</h3>
          <div class="option-list" style="margin-top:16px;">
            <div class="option-card">radius 16</div>
            <div class="data-card">radius 24</div>
            <div class="surface-card">space 16 / 24 / 32</div>
          </div>
        </div>
        <div class="docs-block">
          <h3>Buttons / Options</h3>
          <div class="debug-panel__actions" style="margin-top:16px;">
            <button class="cta-button">CTA</button>
            <button class="ghost-button">Ghost</button>
            <button class="chip-button">Chip</button>
          </div>
          <div class="option-list" style="margin-top:16px;">
            <button class="option-card">기본 상태</button>
            <button class="option-card is-correct">정답 상태</button>
            <button class="option-card is-wrong">오답 상태</button>
            <button class="option-card is-disabled">비활성 상태</button>
          </div>
        </div>
        <div class="docs-block">
          <h3>Asset Structure</h3>
          <div class="docs-asset-list" style="margin-top:16px;">
            <div><strong>avatar</strong><span>head / forehead / eye / mouth</span></div>
            <div><strong>constellations</strong><span>{id}/{id}.webp, optional {id}_hidden.webp</span></div>
            <div><strong>icons</strong><span>common / home / learning / constellation</span></div>
            <div><strong>backgrounds</strong><span>home</span></div>
            <div><strong>ui</strong><span>constellation / decorative</span></div>
          </div>
        </div>
        <div class="docs-block">
          <h3>Icon Preview</h3>
          <div class="icon-preview-grid" style="margin-top:16px;">
            ${[
              ["홈", "asset/icons/common/nav-home.svg"],
              ["기록", "asset/icons/common/nav-records.svg"],
              ["랭킹", "asset/icons/common/nav-ranking.svg"],
              ["별자리", "asset/icons/common/nav-constellations.svg"],
              ["마이", "asset/icons/common/nav-my.svg"],
              ["알림", "asset/icons/home/notice.svg"],
              ["잠금", "asset/icons/constellation/slot-lock.svg"],
              ["별빛", "asset/icons/constellation/progress-star.svg"],
            ]
              .map(
                ([label, path]) => `
                  <div class="icon-preview">
                    <img src="${resolveProjectUrl(path)}" alt="" />
                    <span>${label}</span>
                  </div>
                `,
              )
              .join("")}
          </div>
        </div>
        <div class="docs-block">
          <h3>Bottom Sheet / Modal</h3>
          <div class="sheet-card" style="position:relative; inset:auto; margin-top:16px;">
            <div class="sheet-card__header"><div class="sheet-card__title">선택지</div></div>
            <div class="sheet-card__body"><div class="option-card">예시 선택지</div></div>
          </div>
          <div class="modal-card" style="position:relative; inset:auto; margin-top:16px;">
            <div class="modal-card__header"><div class="modal-card__title">모달</div></div>
            <div class="modal-card__body"><div class="data-card">모달 콘텐츠</div></div>
          </div>
        </div>
        <div class="docs-block">
          <h3>Home / Constellation Preview</h3>
          <div class="docs-preview-grid" style="margin-top:16px;">
            <div class="home-constellation is-complete">
              <span class="constellation-blend-surface home-constellation__media" aria-hidden="true">
                <img class="home-constellation__image" src="${resolveProjectUrl("asset/constellations/gemini/gemini.webp")}" alt="" />
              </span>
              <div class="home-constellation__progress">
                <img class="home-constellation__progress-icon" src="${resolveProjectUrl("asset/icons/constellation/progress-star.svg")}" alt="" />
                <div class="home-constellation__segments">
                  <span class="home-constellation__segment is-active"></span>
                  <span class="home-constellation__segment is-active"></span>
                  <span class="home-constellation__segment is-active"></span>
                  <span class="home-constellation__segment is-active"></span>
                </div>
              </div>
            </div>
            <div class="catalog-card is-complete">
              <div class="catalog-card__frame">
                <span class="constellation-blend-surface catalog-card__media" aria-hidden="true">
                  <img class="catalog-card__image" src="${resolveProjectUrl("asset/constellations/circinus/circinus.webp")}" alt="" />
                </span>
              </div>
              <div class="catalog-card__chip">컴퍼스자리</div>
            </div>
          </div>
        </div>
        <div class="docs-block">
          <h3>Avatar Themes</h3>
          <div class="avatar-grid" style="margin-top:16px;">
            <div class="avatar-chip" data-avatar-sample="green"></div>
            <div class="avatar-chip" data-avatar-sample="pink"></div>
            <div class="avatar-chip" data-avatar-sample="blue"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function buildPageBody(pageId, lesson, state, mode, options = {}) {
  const constellationDebugState = resolveConstellationDebugState(options.constellationDebugState);

  if (pageId === "login") {
    return buildLoginBody(mode);
  }

  if (pageId === "home") {
    const cards = await buildHomeConstellationCards(
      state.homeConstellationIds ?? [],
      state.homeConstellationState ?? {},
      constellationDebugState,
      Math.random,
    );
    state.homeCards = cards;
    return buildHomeBody(lesson, cards, mode, state);
  }

  if (pageId.startsWith("learning-")) {
    return buildLearningBody(pageId, lesson, state, mode);
  }

  if (pageId === "records") {
    return buildRecordsBody(lesson, mode);
  }

  if (pageId === "ranking") {
    return buildRankingBody(state);
  }

  if (pageId === "constellations") {
    const cards = await buildConstellationCatalogCards(
      state.catalogConstellationState ?? {},
      state.recentConstellationIds ?? [],
      constellationDebugState,
      Math.random,
    );
    state.catalogCards = cards;
    return buildConstellationsBody(cards);
  }

  if (pageId === "my") {
    return buildMyBody();
  }

  if (pageId === "docs-design-system") {
    return buildDocsBody();
  }

  return "";
}

function wireGlobalModalEvents(root, store) {
  root.querySelectorAll("[data-modal-close]").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = button.getAttribute("data-modal-close");
      if (target === "hanja") {
        store.update((state) => ({ ...state, hanjaModalWordId: null }));
      }
      if (target === "avatar") {
        store.update((state) => ({ ...state, avatarModalOpen: false, avatarDraft: null }));
      }
      if (target === "attendance") {
        store.update((state) => ({ ...state, attendanceModalOpen: false }));
      }
      if (target === "constellation") {
        clearFlowTimers();
        const current = store.getState();
        const slotId = current.pendingReplacementSlotId;

        if (slotId) {
          const replacementId = await pickReplacementConstellationId(current.homeConstellationIds ?? [], [
            ...(current.recentConstellationIds ?? []),
            slotId,
          ]);
          store.update((state) => {
            const nextIds = [...(state.homeConstellationIds ?? [])];
            const slotIndex = nextIds.indexOf(slotId);
            if (slotIndex !== -1 && replacementId) {
              nextIds[slotIndex] = replacementId;
            }

            return {
              ...state,
              activeConstellationId: null,
              constellationOverlayFace: "front",
              pendingReplacementSlotId: null,
              acquisitionState: "slot-replacing",
              homeConstellationIds: nextIds,
              homeConstellationState: {
                ...(state.homeConstellationState ?? {}),
                [replacementId]: {
                  percent: 0,
                  duplicateCount: 0,
                  phase: "slot-replacing",
                },
              },
              recentConstellationIds: Array.from(new Set([...(state.recentConstellationIds ?? []), slotId])),
            };
          });

          setFlowTimer("toast-charge", () => {
            store.update((state) => ({
              ...state,
              acquisitionState: "idle",
              homeConstellationState: {
                ...(state.homeConstellationState ?? {}),
                [replacementId]: {
                  ...(state.homeConstellationState?.[replacementId] ?? {}),
                  phase: "idle",
                },
              },
            }));
          }, 320);
        } else {
          store.update((state) => ({
            ...state,
            activeConstellationId: null,
            constellationOverlayFace: "front",
          }));
        }
      }
    });
  });

  root.querySelectorAll("[data-sheet-close='cloze']").forEach((button) => {
    button.addEventListener("click", () => {
      store.update((state) => ({ ...state, activeBlankId: null }));
    });
  });
}

function wireHomeEvents(root, store) {
  root.querySelectorAll("[data-avatar-open]").forEach((button) => {
    button.addEventListener("click", () => {
      store.update((state) => ({
        ...state,
        avatarModalOpen: true,
        avatarDraft: { ...(state.avatar ?? DEFAULT_AVATAR) },
        avatarPart: state.avatarPart ?? "eye",
      }));
    });
  });

  root.querySelectorAll("[data-attendance-open]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.hasAttribute("data-home-debug-open")) {
        return;
      }
      store.update((state) => ({ ...state, attendanceModalOpen: true }));
    });
  });

  root.querySelectorAll("[data-constellation-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-constellation-open");
      const homeContent = root.querySelector(".page-content--home");
      const constellationContent = root.querySelector(".page-content--constellations");
      if (homeContent) {
        root.dataset.homeScrollTop = String(homeContent.scrollTop);
      }
      if (constellationContent) {
        root.dataset.constellationScrollTop = String(constellationContent.scrollTop);
      }
      store.update((state) => ({
        ...state,
        activeConstellationId: id,
        constellationOverlayFace: "front",
        pendingReplacementSlotId: null,
      }));
      vibrate(12);
    });
  });
}

function wireAvatarEvents(root, store) {
  const preview = root.querySelector(".avatar-editor__preview");
  const optionGrid = root.querySelector(".avatar-option-grid");
  const saveButton = root.querySelector("[data-avatar-save]");
  if (!preview || !optionGrid || !saveButton) {
    return;
  }

  let draft = { ...(store.getState().avatarDraft ?? store.getState().avatar ?? DEFAULT_AVATAR) };
  let avatarPart = store.getState().avatarPart ?? "eye";

  const syncAvatarUi = async () => {
    preview.innerHTML = await buildAvatarMarkup(draft);
    root.querySelectorAll("[data-avatar-theme]").forEach((button) => {
      button.classList.toggle("is-selected", button.getAttribute("data-avatar-theme") === draft.theme);
    });
    root.querySelectorAll("[data-avatar-part]").forEach((button) => {
      button.classList.toggle("is-selected", button.getAttribute("data-avatar-part") === avatarPart);
    });
    optionGrid.innerHTML = buildAvatarOptionGridMarkup(avatarPart, draft);
  };

  root.querySelectorAll("[data-avatar-theme]").forEach((button) => {
    button.addEventListener("click", async () => {
      const theme = button.getAttribute("data-avatar-theme");
      draft = { ...draft, theme };
      await syncAvatarUi();
    });
  });

  root.querySelectorAll("[data-avatar-part]").forEach((button) => {
    button.addEventListener("click", async () => {
      avatarPart = button.getAttribute("data-avatar-part") ?? "eye";
      await syncAvatarUi();
    });
  });

  optionGrid.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-avatar-option]");
    if (!button) {
      return;
    }

    const payload = button.getAttribute("data-avatar-option") ?? "";
    const [part, rawIndex] = payload.split(":");
    const index = Number(rawIndex);
    if (!part || Number.isNaN(index)) {
      return;
    }

    draft = {
      ...draft,
      [part]: index,
    };
    await syncAvatarUi();
  });

  root.querySelectorAll("[data-avatar-cancel]").forEach((button) => {
    button.addEventListener("click", () => {
      clearFlowTimer("toast-charge");
      store.update((state) => ({ ...state, avatarModalOpen: false, avatarDraft: null }));
    });
  });

  root.querySelectorAll("[data-avatar-save]").forEach((button) => {
    button.addEventListener("click", () => {
      store.update((state) => ({
        ...state,
        avatar: { ...draft },
        avatarDraft: null,
        avatarPart,
        avatarModalOpen: false,
      }));
    });
  });
}

function wireHanjaEvents(root, store) {
  root.querySelectorAll("[data-hanja-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const wordId = button.getAttribute("data-hanja-open");
      store.update((state) => ({ ...state, hanjaModalWordId: wordId }));
    });
  });
}

function wireClozeEvents(root, store, cloze) {
  root.querySelectorAll("[data-blank-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const blankId = button.getAttribute("data-blank-open");
      store.update((state) => ({ ...state, activeBlankId: blankId }));
    });
  });

  root.querySelectorAll("[data-cloze-option]").forEach((button) => {
    button.addEventListener("click", () => {
      const blankId = store.getState().activeBlankId;
      if (!blankId) {
        return;
      }

      const value = button.getAttribute("data-cloze-option");
      const blank = cloze?.blanks?.find((item) => item.id === blankId);
      const answers = { ...(store.getState().clozeAnswers ?? {}), [blankId]: value };
      const correct = blank?.answer === value;
      button.classList.add(correct ? "is-correct" : "is-wrong");
      if (!correct) {
        button.classList.add("shake");
      }
      vibrate(correct ? 16 : [10, 24, 10]);
      if (correct) {
        window.setTimeout(() => {
          store.update((state) => ({ ...state, clozeAnswers: answers, activeBlankId: null }));
        }, 160);
      }
    });
  });
}

export async function prepareInitialState() {
  const preferredHomeIds = ["gemini", "perseus", "leo", "lyra"];
  const preferredHomeConstellations = await Promise.all(preferredHomeIds.map((id) => getConstellationById(id)));
  const hasPreferredHomeSet = preferredHomeConstellations.every(Boolean);
  const homeConstellations = hasPreferredHomeSet ? preferredHomeConstellations : await getInitialHomeConstellations();
  const progressPattern = [34, 34, 67, 100];
  const homeConstellationState = Object.fromEntries(
    homeConstellations.map((item, index) => [
      item.id,
      {
        percent: progressPattern[index] ?? 0,
        duplicateCount: item.id === "lyra" ? 2 : 0,
      },
    ]),
  );

  const recentConstellationIds = ["circinus", "lyra", "leo", "gemini"];
  const catalogConstellationState = {
    circinus: {
      percent: 100,
      duplicateCount: 2,
    },
    lyra: {
      percent: 100,
      duplicateCount: 1,
    },
    leo: {
      percent: 100,
      duplicateCount: 0,
    },
    gemini: {
      percent: 100,
      duplicateCount: 0,
    },
  };

  return {
    homeConstellationIds: homeConstellations.map((item) => item.id),
    homeConstellationState,
    catalogConstellationState,
    recentConstellationIds,
    activeConstellationId: null,
    hanjaModalWordId: null,
    attendanceModalOpen: false,
    avatarModalOpen: false,
    avatar: { ...DEFAULT_AVATAR },
    avatarDraft: null,
    avatarPart: "eye",
    todayScore: 0,
    streakDays: 5,
    learningScore: "42점",
    homeLessonRows: DEFAULT_HOME_LESSON_ROWS,
    activeToast: null,
    constellationOverlayFace: "front",
    pendingReplacementSlotId: null,
    acquisitionState: "idle",
    letterVariant: "lowerGrade",
    activeBlankId: null,
    clozeAnswers: {},
  };
}

function getAcquisitionTargetId(state) {
  const candidates = Object.entries(state.homeConstellationState ?? {})
    .filter(([, value]) => (value?.percent ?? 0) < 100)
    .sort((left, right) => (right[1]?.percent ?? 0) - (left[1]?.percent ?? 0));

  return candidates[0]?.[0] ?? state.homeConstellationIds?.[0] ?? null;
}

export function startHomePrototypeAcquisition(store, explicitTargetId = null) {
  const current = store.getState();
  const targetId = explicitTargetId ?? getAcquisitionTargetId(current);

  if (!targetId) {
    return;
  }

  clearFlowTimers();
  store.update((state) => {
    const nextHomeState = {
      ...(state.homeConstellationState ?? {}),
      [targetId]: {
        ...(state.homeConstellationState?.[targetId] ?? {}),
        phase: "charging",
      },
    };

    return {
      ...state,
      activeToast: "별자리에 별빛이 채워지고 있어요…",
      acquisitionState: "charging",
      homeDebugOpen: false,
      homeConstellationState: nextHomeState,
    };
  });

  setFlowTimer("charge-complete", () => {
    store.update((state) => {
      const targetCard = state.homeConstellationState?.[targetId] ?? {};
      const targetName = state.homeCards?.find((item) => item.id === targetId)?.nameKo ?? "별자리";
      return {
        ...state,
        activeToast: `${targetName} 카드를 획득했어요!`,
        acquisitionState: "completed",
        homeConstellationState: {
          ...(state.homeConstellationState ?? {}),
          [targetId]: {
            ...targetCard,
            percent: 100,
            duplicateCount: targetCard.duplicateCount ?? 0,
            phase: "completed",
          },
        },
      };
    });
  }, 1200);

  setFlowTimer("card-front", () => {
    store.update((state) => ({
      ...state,
      activeToast: null,
      acquisitionState: "card-front-visible",
      activeConstellationId: targetId,
      constellationOverlayFace: "front",
      pendingReplacementSlotId: targetId,
    }));
  }, 1880);
}

export async function renderPage({ pageId, mode, mount, store, renderDebugPanels, constellationDebugState = null }) {
  const lesson = await getLessonMeta();
  const state = store.getState();
  const existingHomeContent = mount.querySelector(".page-content--home");
  const existingConstellationContent = mount.querySelector(".page-content--constellations");
  const retainedHomeScrollTop = existingHomeContent?.scrollTop ?? Number(mount.dataset.homeScrollTop || 0);
  const retainedConstellationScrollTop =
    existingConstellationContent?.scrollTop ?? Number(mount.dataset.constellationScrollTop || 0);
  state.avatarMarkup = await buildAvatarMarkup(state.avatar);
  state.avatarButtonMarkup = await buildAvatarMarkup(state.avatar, { small: true });
  state.avatarDraftMarkup = await buildAvatarMarkup(state.avatarDraft ?? state.avatar);
  const body = await buildPageBody(pageId, lesson, state, mode, { constellationDebugState });
  const activeWord = state.hanjaModalWordId ? await getWordById(state.hanjaModalWordId) : null;
  const activeConstellation = state.activeConstellationId
    ? state.homeCards?.find((item) => item.id === state.activeConstellationId) ??
      state.catalogCards?.find((item) => item.id === state.activeConstellationId) ??
      (await getConstellationById(state.activeConstellationId))
    : null;
  if (activeConstellation) {
    activeConstellation.overlayFace = state.constellationOverlayFace ?? "front";
    if (state.pendingReplacementSlotId === activeConstellation.id) {
      activeConstellation.completed = true;
      activeConstellation.asset = activeConstellation.illustration ?? activeConstellation.asset;
    }
  }
  const topBar = buildTopBar(pageId, mode, lesson, state);
  const nav = buildNav(pageId, mode);
  const cloze = pageId === "learning-passage-cloze" ? await getPassageClozeModel() : null;
  const isDocs = pageId === "docs-design-system";
  const isCompactShell = pageId === "login";
  const usesHomeShell = ["home", "constellations", "records", "ranking", "my"].includes(pageId);
  const shellClass = isDocs
    ? "docs-canvas"
    : `miri-shell ${isCompactShell ? "miri-shell--compact" : "miri-shell--app"} miri-shell--${pageId} ${usesHomeShell ? "home-shell" : ""}`;

  mount.innerHTML = `
    <div class="page-root">
      <div class="${shellClass}">
        ${isDocs ? body : `
          ${usesHomeShell ? `<div class="home-background home-background--${pageId}" aria-hidden="true"></div>` : ""}
          <div class="page-stack">
            ${topBar}
            <main class="page-content page-content--${pageId}">${body}</main>
            ${renderDebugPanels ? renderDebugPanels({ pageId, state }) : ""}
            ${buildToastLayer(state)}
            ${buildHanjaModal(activeWord)}
            ${buildAttendanceModal(state)}
            ${buildAvatarModal(state)}
            ${buildConstellationOverlay(activeConstellation, state)}
            ${nav}
          </div>
        `}
      </div>
    </div>
  `;

  wireGlobalModalEvents(mount, store);
  wireHomeEvents(mount, store);
  wireAvatarEvents(mount, store);
  wireHanjaEvents(mount, store);
  wireTouchZoomGuard(mount, pageId);

  if (pageId === "constellations") {
    mount.dataset.constellationScrollTop = String(retainedConstellationScrollTop || 0);
    requestAnimationFrame(() => {
      const nextConstellationContent = mount.querySelector(".page-content--constellations");
      if (!nextConstellationContent) {
        return;
      }
      nextConstellationContent.scrollTop = Number(retainedConstellationScrollTop) || 0;
    });
  }

  if (pageId === "home") {
    mount.dataset.homeScrollTop = String(retainedHomeScrollTop || 0);
    requestAnimationFrame(() => {
      const nextHomeContent = mount.querySelector(".page-content--home");
      if (!nextHomeContent) {
        return;
      }
      nextHomeContent.scrollTop = Number(retainedHomeScrollTop) || 0;
    });
  }

  if (pageId === "learning-passage-cloze") {
    wireClozeEvents(mount, store, cloze);
  }

  if (pageId === "docs-design-system") {
    const themes = ["green", "pink", "blue"];
    await Promise.all(
      themes.map(async (theme) => {
        const container = mount.querySelector(`[data-avatar-sample="${theme}"]`);
        if (container) {
          container.innerHTML = await buildAvatarMarkup({ theme }, { small: true });
        }
      }),
    );
  }
}

function wireTouchZoomGuard(root, pageId) {
  if (!["home", "records", "ranking", "constellations", "my"].includes(pageId)) {
    return;
  }

  const shell = root.querySelector(".miri-shell");
  if (!shell) {
    return;
  }

  let lastTouchEnd = 0;

  shell.addEventListener("dblclick", (event) => {
    event.preventDefault();
  });

  shell.addEventListener(
    "touchend",
    (event) => {
      const now = Date.now();
      if (now - lastTouchEnd < 280) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    },
    { passive: false },
  );

  shell.addEventListener("gesturestart", (event) => {
    event.preventDefault();
  });
}
