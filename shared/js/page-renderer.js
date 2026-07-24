import { DEFAULT_AVATAR, HOME_CONSTELLATION_COUNT, HOME_PROFILE, NAV_ITEMS, PAGE_TITLES } from "./app-config.js?v=20260724a";
import {
  buildConstellationCatalogCards,
  buildHomeConstellationCards,
  getConstellationById,
  getInitialHomeConstellations,
  loadConstellationCatalog,
} from "./constellation-adapter.js?v=20260724a";
import { buildAvatarMarkup, getAvatarPreviewAssetPath } from "./avatar-utils.js?v=20260724a";
import { resolveProjectUrl } from "./data-loader.js?v=20260724a";
import { getLessonMeta } from "./learning-adapter.js?v=20260724a";
import { vibrate } from "./haptics.js?v=20260724a";

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
  "constellation-flash",
];

const flowTimers = new Map();
const REWARD_STAR_ASSET = "asset/ui/constellation/star.png";
const HOME_REWARD_SESSION_KEY = "miri-textbook-home-reward";
const LOCKED_CATALOG_MOCKS = [
  {
    id: "locked-mock-a",
  },
  {
    id: "locked-mock-b",
  },
];
const CONSTELLATION_NOTICE_POSTS = [
  {
    id: "notice-card-update",
    title: "별자리 카드 업데이트 안내",
    body: "별자리 카드는 학습 완료 후 별을 모아 완성하고, 홈에서 직접 받아 도감에 등록할 수 있어요.",
  },
  {
    id: "notice-new-constellation",
    title: "새로운 별자리 추가 예정",
    body: "도감에는 88개 공식 별자리를 모두 준비해 두었고, 이후 이벤트용 mock 카드 예시도 함께 확인할 수 있어요.",
  },
  {
    id: "notice-learning-reward",
    title: "학습 보상 안내",
    body: "오늘의 학습을 완료하면 별을 받고, 별이 홈의 별자리 슬롯으로 날아가며 진행도가 채워집니다.",
  },
  {
    id: "notice-maintenance",
    title: "서비스 점검 안내",
    body: "프로토타입 검수 중에는 일부 별자리 목록과 카드 설명이 수시로 조정될 수 있어요.",
  },
];

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

function wait(delay) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delay);
  });
}

function normalizeRewardCount(value) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return 1;
  }

  return Math.max(1, Math.min(2, Math.round(parsed)));
}

function getConstellationDebugPreset(state) {
  return Number(state.constellationDebug?.preset ?? 0);
}

function isHomeConstellationCollectible(state, cardId) {
  if (!cardId) {
    return false;
  }

  const slotState = state.homeConstellationState?.[cardId];
  return (state.homeConstellationIds ?? []).includes(cardId) && (slotState?.percent ?? 0) >= 100;
}

function isHomeConstellationRewardReady(state, cardId) {
  if (!cardId || !(state.homeConstellationIds ?? []).includes(cardId)) {
    return false;
  }

  if (isHomeConstellationCollectible(state, cardId)) {
    return true;
  }

  return Boolean(state.homeCards?.find((item) => item.id === cardId)?.completed);
}

function buildRewardModalCopy(starCount) {
  return {
    title: `별 ${starCount}개를 받았어요!`,
    body: `오늘의 학습을 완료해서\n우주에 채울 별을 받았어요.`,
  };
}

function getHomeRewardPayload() {
  try {
    const raw = window.sessionStorage.getItem(HOME_REWARD_SESSION_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      starCount: normalizeRewardCount(parsed.starCount),
      source: parsed.source ?? "lesson-complete",
    };
  } catch (error) {
    return null;
  }
}

export function consumeHomeRewardPayload() {
  const payload = getHomeRewardPayload();

  try {
    window.sessionStorage.removeItem(HOME_REWARD_SESSION_KEY);
  } catch (error) {
    void error;
  }

  return payload;
}

function buildRewardTargetIds(state, starCount) {
  const ids = [...(state.homeConstellationIds ?? [])];
  const preset = getConstellationDebugPreset(state);
  const availableIds = ids.filter((id) => (state.homeConstellationState?.[id]?.percent ?? 0) < 100);
  const shuffled = [...(availableIds.length ? availableIds : ids)].sort(() => Math.random() - 0.5);
  const uniqueTargets = shuffled.slice(0, Math.min(starCount, shuffled.length));

  return {
    targetIds: uniqueTargets,
    simulateOnly: preset >= 100,
  };
}

function createRewardModalState(starCount, targets, simulateOnly, source = "debug") {
  return {
    starCount: normalizeRewardCount(starCount),
    targetIds: [...targets],
    simulateOnly,
    source,
    status: "open",
  };
}

function getConstellationTargetRect(root, targetId) {
  const slot = root.querySelector(`[data-constellation-id="${targetId}"] .home-constellation__media`) ??
    root.querySelector(`[data-constellation-id="${targetId}"]`);
  return slot?.getBoundingClientRect() ?? null;
}

async function flashConstellationSlot(store, targetId) {
  store.update((state) => ({
    ...state,
    flashingConstellationIds: Array.from(new Set([...(state.flashingConstellationIds ?? []), targetId])),
  }));

  setFlowTimer(`constellation-flash-${targetId}`, () => {
    store.update((state) => ({
      ...state,
      flashingConstellationIds: (state.flashingConstellationIds ?? []).filter((id) => id !== targetId),
    }));
  }, 280);
}

async function applyRewardArrival(store, targetId) {
  const constellation = await getConstellationById(targetId);
  if (!constellation) {
    return;
  }

  const requiredLight = Math.max(1, Number(constellation.requiredLight) || 1);
  store.update((state) => {
    const current = state.homeConstellationState?.[targetId] ?? {};
    const currentLight = Math.min(requiredLight, Math.max(0, Math.round((requiredLight * (current.percent ?? 0)) / 100)));
    const nextLight = Math.min(requiredLight, currentLight + 1);
    const nextPercent = Math.round((nextLight / requiredLight) * 100);
    const isCompleted = nextLight >= requiredLight;

    return {
      ...state,
      homeConstellationState: {
        ...(state.homeConstellationState ?? {}),
        [targetId]: {
          ...current,
          percent: nextPercent,
          phase: isCompleted ? "completed" : "idle",
        },
      },
    };
  });

  await flashConstellationSlot(store, targetId);
}

function buildLockedCatalogMockCard(card) {
  return `
    <article class="catalog-card catalog-card--sample is-locked" aria-hidden="true" data-constellation-id="${card.id}">
      <div class="catalog-card__frame">
        <img class="catalog-card__lock" src="${resolveProjectUrl("asset/icons/constellation/slot-lock.svg")}" alt="" />
      </div>
    </article>
  `;
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
    const noticeAttributes = pageId === "constellations"
      ? `data-catalog-notice-open="true" aria-label="공지사항 열기"`
      : `data-attendance-open="true" aria-label="연속 출석 정보 열기"`;

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
          <button class="home-notice" type="button" ${noticeAttributes}>
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

function buildHomeConstellation(card) {
  const previewAsset = card.asset ?? (card.completed ? card.illustration : card.hidden ?? card.illustration);
  const phaseClass = card.phase ? `is-${card.phase}` : "";
  const flashClass = card.isFlashing ? "is-flashing" : "";
  const openAttribute = card.completed ? `data-constellation-open="${card.id}"` : "";
  const disabledAttribute = card.completed ? "" : 'disabled aria-disabled="true"';

  return `
    <button class="home-constellation home-constellation-slot ${card.completed ? "is-complete" : "is-locked"} ${phaseClass} ${flashClass}" type="button" ${openAttribute} ${disabledAttribute} data-constellation-id="${card.id}" data-constellation-source="home">
      <span class="constellation-blend-surface home-constellation__media" aria-hidden="true">
        <img class="home-constellation__image" src="${resolveProjectUrl(previewAsset)}" alt="" ${safeImageAttributes()} />
      </span>
      <div class="home-constellation__progress home-progress-badge">
        <span class="home-constellation__progress-star">
          <img class="home-constellation__progress-icon" src="${resolveProjectUrl("asset/ui/constellation/star.png")}" alt="" />
        </span>
        <div class="home-constellation__segments">
          ${card.progressSegments.map((segment) => `<span class="home-constellation__segment ${segment.active ? "is-active" : ""}"></span>`).join("")}
        </div>
      </div>
    </button>
  `;
}

function buildCatalogConstellation(card) {
  const previewAsset = card.illustration ?? card.asset ?? card.hidden;
  return `
    <button class="catalog-card is-complete" type="button" data-constellation-open="${card.id}" data-constellation-source="catalog">
      <div class="catalog-card__frame">
        <span class="constellation-blend-surface catalog-card__media" aria-hidden="true">
          <img class="catalog-card__image" src="${resolveProjectUrl(previewAsset)}" alt="" ${safeImageAttributes()} />
        </span>
      </div>
      <div class="catalog-card__chip">${escapeHtml(card.nameKo)}</div>
      ${card.duplicateCount > 1 ? `<span class="catalog-card__badge">×${card.duplicateCount}</span>` : ""}
    </button>
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

  const isCollectible = state.activeConstellationSource === "home" && isHomeConstellationRewardReady(state, card.id);
  const imageSrc = card.illustration ?? card.asset ?? card.hidden;

  return `
    <div class="modal-layer fade-in">
      <div class="modal-backdrop" data-modal-close="constellation"></div>
      <div class="overlay-card">
        <div class="constellation-overlay">
          <button class="constellation-overlay__close" data-modal-close="constellation">×</button>
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
                  isCollectible
                    ? `
                        <div class="constellation-overlay__acquire-actions">
                          <button class="constellation-overlay__receive-button" type="button" data-constellation-receive="${card.id}">받기</button>
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

function buildRewardModal(state) {
  const reward = state.rewardModal;
  if (!reward) {
    return "";
  }

  const { title, body } = buildRewardModalCopy(reward.starCount);
  const modalClass = reward.status === "launching" ? "reward-modal is-launching" : "reward-modal";
  const stars = Array.from({ length: reward.starCount }, (_, index) => {
    const sizeClass = reward.starCount === 2 ? "is-pair" : "is-single";
    return `
      <span class="reward-modal__star ${sizeClass}" data-reward-star-index="${index}">
        <img src="${resolveProjectUrl(REWARD_STAR_ASSET)}" alt="" ${safeImageAttributes()} />
      </span>
    `;
  }).join("");

  return `
    <div class="modal-layer fade-in" data-reward-modal>
      <div class="modal-backdrop"></div>
      <div class="${modalClass}">
        <div class="reward-modal__dialog">
          <div class="reward-modal__stars">${stars}</div>
          <div class="reward-modal__copy">
            <strong>${escapeHtml(title)}</strong>
            <p>${escapeHtml(body).replace("\n", "<br />")}</p>
          </div>
          <button class="reward-modal__confirm" type="button" data-reward-confirm="true">확인</button>
        </div>
      </div>
    </div>
  `;
}

function buildConstellationNoticeModal(state) {
  if (!state.catalogNoticeOpen) {
    return "";
  }

  return `
    <div class="modal-layer fade-in">
      <div class="modal-backdrop" data-modal-close="catalog-notice"></div>
      <div class="modal-card modal-card--home slide-up constellation-notice-modal">
        <div class="modal-card__header modal-card__header--home">
          <div class="modal-card__title modal-card__title--home">공지사항</div>
          <button class="icon-button icon-button--clear" type="button" data-modal-close="catalog-notice">×</button>
        </div>
        <div class="modal-card__body modal-card__body--home">
          <div class="notice-accordion">
            ${CONSTELLATION_NOTICE_POSTS.map((post) => {
              const expanded = state.catalogNoticeActiveId === post.id;
              return `
                <article class="notice-accordion__item ${expanded ? "is-open" : ""}">
                  <button class="notice-accordion__trigger" type="button" data-notice-toggle="${post.id}" aria-expanded="${expanded ? "true" : "false"}">
                    <span>${escapeHtml(post.title)}</span>
                    <i>${expanded ? "−" : "+"}</i>
                  </button>
                  ${expanded ? `<div class="notice-accordion__body">${escapeHtml(post.body)}</div>` : ""}
                </article>
              `;
            }).join("")}
          </div>
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

function resolveConstellationDebugState(constellationDebugState) {
  return constellationDebugState ?? { preset: 0 };
}

function buildHomeBody(lesson, cards, mode, state) {
  return `
    <div class="home-content">
      ${buildHomeHeaderStats({ todayScore: state.todayScore, streakDays: state.streakDays })}
      ${buildConstellationField(cards)}
      ${buildStudyCard(mode, state)}
    </div>
  `;
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

function buildConstellationsBody(cards, state) {
  return `
    <div class="catalog-content">
      <section class="catalog-heading">
        <span>별자리 도감</span>
      </section>
      <section class="catalog-grid">
        ${cards.map((card) => buildCatalogConstellation(card)).join("")}
        ${LOCKED_CATALOG_MOCKS.map((card) => buildLockedCatalogMockCard(card)).join("")}
      </section>
      ${buildConstellationNoticeModal(state)}
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
              ["별빛", "asset/ui/constellation/star.png"],
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
                <img class="home-constellation__image" src="${resolveProjectUrl("asset/constellation/gemini/gemini.webp")}" alt="" />
              </span>
              <div class="home-constellation__progress">
                <span class="home-constellation__progress-star">
                  <img class="home-constellation__progress-icon" src="${resolveProjectUrl("asset/ui/constellation/star.png")}" alt="" />
                </span>
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
                  <img class="catalog-card__image" src="${resolveProjectUrl("asset/constellation/circinus/circinus.webp")}" alt="" />
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
    const cards = (await buildHomeConstellationCards(
      state.homeConstellationIds ?? [],
      state.homeConstellationState ?? {},
      constellationDebugState,
      Math.random,
    )).map((card) => ({
      ...card,
      isFlashing: (state.flashingConstellationIds ?? []).includes(card.id),
    }));
    state.homeCards = cards;
    return buildHomeBody(lesson, cards, mode, state);
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
    return buildConstellationsBody(cards, state);
  }

  if (pageId === "my") {
    return buildMyBody();
  }

  if (pageId === "docs-design-system") {
    return buildDocsBody();
  }

  return "";
}

async function handleConstellationReceive(root, store, constellationId) {
  const current = store.getState();
  if (!isHomeConstellationRewardReady(current, constellationId)) {
    return;
  }

  const replacementId = await pickReplacementConstellationId(current.homeConstellationIds ?? [], [
    ...(current.recentConstellationIds ?? []),
    constellationId,
  ]);

  store.update((state) => ({
    ...state,
    activeConstellationId: null,
    activeConstellationSource: null,
    constellationOverlayFace: "front",
  }));

  await wait(16);

  const slot = root.querySelector(`[data-constellation-id="${constellationId}"]`);
  await slot?.animate(
    [
      { transform: "scale(1)", opacity: 1 },
      { transform: "scale(0.85)", opacity: 0 },
    ],
    {
      duration: 260,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      fill: "forwards",
    },
  )?.finished?.catch(() => null);

  store.update((state) => {
    const nextIds = [...(state.homeConstellationIds ?? [])];
    const slotIndex = nextIds.indexOf(constellationId);
    if (slotIndex !== -1 && replacementId) {
      nextIds[slotIndex] = replacementId;
    }

    return {
      ...state,
      homeConstellationIds: nextIds,
      homeConstellationState: {
        ...(state.homeConstellationState ?? {}),
        [constellationId]: {
          ...(state.homeConstellationState?.[constellationId] ?? {}),
          duplicateCount: 0,
          phase: "collected",
        },
        ...(replacementId
          ? {
              [replacementId]: {
                percent: 0,
                duplicateCount: 0,
                phase: "idle",
              },
            }
          : {}),
      },
      catalogConstellationState: {
        ...(state.catalogConstellationState ?? {}),
        [constellationId]: {
          percent: 100,
          duplicateCount: (state.catalogConstellationState?.[constellationId]?.duplicateCount ?? 0) + 1,
        },
      },
      recentConstellationIds: Array.from(new Set([constellationId, ...(state.recentConstellationIds ?? [])])),
    };
  });

  await wait(16);

  const replacementSlot = replacementId ? root.querySelector(`[data-constellation-id="${replacementId}"]`) : null;
  await replacementSlot?.animate(
    [
      { transform: "scale(0.92)", opacity: 0 },
      { transform: "scale(1)", opacity: 1 },
    ],
    {
      duration: 280,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "both",
    },
  )?.finished?.catch(() => null);
}

function wireGlobalModalEvents(root, store) {
  root.querySelectorAll("[data-modal-close]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.getAttribute("data-modal-close");
      if (target === "avatar") {
        store.update((state) => ({ ...state, avatarModalOpen: false, avatarDraft: null }));
      }
      if (target === "attendance") {
        store.update((state) => ({ ...state, attendanceModalOpen: false }));
      }
      if (target === "catalog-notice") {
        store.update((state) => ({ ...state, catalogNoticeOpen: false }));
      }
      if (target === "constellation") {
        store.update((state) => ({
          ...state,
          activeConstellationId: null,
          activeConstellationSource: null,
          constellationOverlayFace: "front",
        }));
      }
    });
  });

  root.querySelectorAll("[data-reward-confirm]").forEach((button) => {
    button.addEventListener("click", async () => {
      const reward = store.getState().rewardModal;
      if (!reward) {
        return;
      }

      await runRewardFlight(root, store, reward);
    });
  });

  root.querySelectorAll("[data-notice-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const noticeId = button.getAttribute("data-notice-toggle");
      store.update((state) => {
        if (!noticeId || state.catalogNoticeActiveId === noticeId) {
          return state;
        }

        return {
          ...state,
          catalogNoticeActiveId: noticeId,
        };
      });
    });
  });

  root.querySelectorAll("[data-catalog-notice-open]").forEach((button) => {
    button.addEventListener("click", () => {
      store.update((state) => ({
        ...state,
        catalogNoticeOpen: true,
      }));
    });
  });

  root.querySelectorAll("[data-constellation-receive]").forEach((button) => {
    button.addEventListener("click", async () => {
      const constellationId = button.getAttribute("data-constellation-receive");
      if (!constellationId) {
        return;
      }

      await handleConstellationReceive(root, store, constellationId);
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
      const source = button.getAttribute("data-constellation-source") ?? (button.classList.contains("catalog-card") ? "catalog" : "home");
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
        activeConstellationSource: source,
        constellationOverlayFace: "front",
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
    activeConstellationSource: null,
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
    rewardModal: null,
    flashingConstellationIds: [],
    catalogNoticeOpen: false,
    catalogNoticeActiveId: CONSTELLATION_NOTICE_POSTS[0]?.id ?? null,
  };
}

async function animateRewardStar(startRect, targetRect) {
  if (!startRect || !targetRect) {
    return;
  }

  const layer = document.createElement("div");
  layer.className = "reward-flight-layer";
  const star = document.createElement("img");
  star.className = "reward-flight-star";
  star.src = resolveProjectUrl(REWARD_STAR_ASSET);
  star.alt = "";
  star.style.left = `${startRect.left + startRect.width / 2 - 18}px`;
  star.style.top = `${startRect.top + startRect.height / 2 - 18}px`;
  layer.appendChild(star);
  document.body.appendChild(layer);

  const dx = targetRect.left + targetRect.width / 2 - (startRect.left + startRect.width / 2);
  const dy = targetRect.top + targetRect.height / 2 - (startRect.top + startRect.height / 2);
  const controlY = dy * 0.42 - 112;
  const animation = star.animate(
    [
      { transform: "translate3d(0, 0, 0) scale(1) rotate(0deg)", opacity: 1, offset: 0 },
      { transform: "translate3d(0, -18px, 0) scale(1.16) rotate(-8deg)", opacity: 1, offset: 0.18 },
      { transform: `translate3d(${dx * 0.48}px, ${controlY}px, 0) scale(1.02) rotate(132deg)`, opacity: 1, offset: 0.62 },
      { transform: `translate3d(${dx}px, ${dy}px, 0) scale(0.84) rotate(244deg)`, opacity: 1, offset: 0.9 },
      { transform: `translate3d(${dx}px, ${dy}px, 0) scale(0.32) rotate(270deg)`, opacity: 0, offset: 1 },
    ],
    {
      duration: 1480,
      easing: "cubic-bezier(0.18, 0.72, 0.24, 1)",
      fill: "forwards",
    },
  );

  await animation.finished.catch(() => null);
  layer.remove();
}

async function runRewardFlight(root, store, reward) {
  const modal = root.querySelector("[data-reward-modal]");
  const stars = [...(modal?.querySelectorAll("[data-reward-star-index]") ?? [])];
  const startRects = stars.map((node) => node.getBoundingClientRect());

  store.update((state) => ({
    ...state,
    rewardModal: state.rewardModal ? { ...state.rewardModal, status: "launching" } : null,
    homeDebugOpen: false,
  }));

  await wait(140);

  for (let index = 0; index < reward.targetIds.length; index += 1) {
    const targetId = reward.targetIds[index];
    const startRect = startRects[index] ?? startRects[startRects.length - 1] ?? null;
    const targetRect = getConstellationTargetRect(root, targetId);
    await animateRewardStar(startRect, targetRect);

    if (!reward.simulateOnly) {
      await applyRewardArrival(store, targetId);
    }

    await wait(40);
  }

  store.update((state) => ({
    ...state,
    rewardModal: null,
  }));
}

export function startRewardFlow(store, starCount = 1, options = {}) {
  const current = store.getState();
  if (current.rewardModal) {
    return false;
  }

  const normalizedCount = normalizeRewardCount(starCount);
  const rewardTargets = options.targetIds?.length
    ? { targetIds: [...options.targetIds].slice(0, normalizedCount), simulateOnly: Boolean(options.simulateOnly) }
    : buildRewardTargetIds(current, normalizedCount);

  if (!rewardTargets.targetIds.length && !rewardTargets.simulateOnly) {
    return false;
  }

  store.update((state) => ({
    ...state,
    rewardModal: createRewardModalState(
      normalizedCount,
      rewardTargets.targetIds,
      rewardTargets.simulateOnly,
      options.source ?? "debug",
    ),
    activeConstellationId: null,
    activeConstellationSource: null,
    homeDebugOpen: false,
  }));

  return true;
}

export function startHomePrototypeAcquisition(store, starCount = 1, options = {}) {
  return startRewardFlow(store, starCount, options);
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
  const activeConstellation = state.activeConstellationId
    ? state.homeCards?.find((item) => item.id === state.activeConstellationId) ??
      state.catalogCards?.find((item) => item.id === state.activeConstellationId) ??
      (await getConstellationById(state.activeConstellationId))
    : null;
  if (activeConstellation) {
    activeConstellation.overlayFace = state.constellationOverlayFace ?? "front";
    if (isHomeConstellationCollectible(state, activeConstellation.id)) {
      activeConstellation.completed = true;
      activeConstellation.asset = activeConstellation.illustration ?? activeConstellation.asset;
    }
  }
  const topBar = buildTopBar(pageId, mode, lesson, state);
  const nav = buildNav(pageId, mode);
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
            ${buildAttendanceModal(state)}
            ${buildAvatarModal(state)}
            ${buildRewardModal(state)}
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
