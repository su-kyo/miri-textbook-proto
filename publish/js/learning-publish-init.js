import {
  getHanjaCharacterRows,
  getLessonMeta,
  getPassageClozeModel,
  getPassageMcQuestions,
  getPassageOxQuestions,
  getVocabCardDeck,
  getVocabLetterSet,
  getVocabMatchingPairs,
  getVocabMeaningQuestions,
  getVocabularyList,
} from "../../shared/js/learning-adapter.js";

const TAP_ICON = `
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M6.6 1.4C6.6 0.9 6.95 0.5 7.45 0.5C7.95 0.5 8.3 0.9 8.3 1.4V7.05L9.05 6.3C9.4 5.95 9.95 5.95 10.3 6.3C10.65 6.65 10.65 7.2 10.3 7.55L7.95 9.9C7.6 10.25 7.05 10.25 6.7 9.9L4.35 7.55C4 7.2 4 6.65 4.35 6.3C4.7 5.95 5.25 5.95 5.6 6.3L6.6 7.3V1.4Z" fill="currentColor"/>
    <path d="M3 10.1C3 9.6 3.4 9.2 3.9 9.2C4.4 9.2 4.8 9.6 4.8 10.1V10.55C4.8 11.5 5.55 12.25 6.5 12.25H9.5C10.45 12.25 11.2 11.5 11.2 10.55V10.1C11.2 9.6 11.6 9.2 12.1 9.2C12.6 9.2 13 9.6 13 10.1V10.55C13 12.5 11.45 14.05 9.5 14.05H6.5C4.55 14.05 3 12.5 3 10.55V10.1Z" fill="currentColor"/>
  </svg>
`;

const pageId = document.body.dataset.page;
const initialQuery = new URLSearchParams(window.location.search);
const pageMode = document.body.dataset.mode === "prototype" || initialQuery.get("mode") === "prototype" ? "prototype" : "publish";
const LEARNING_STAGE_DATA = [
  { label: "짝 맞추기", icon: "asset/icons/learning/vocab-matching.svg", correct: 3, total: 4 },
  { label: "글자 맞추기", icon: "asset/icons/learning/vocab-letter.svg", correct: 2, total: 3 },
  { label: "어휘 뜻 맞히기", icon: "asset/icons/learning/vocab-mc.svg", correct: 2, total: 3 },
  { label: "OX 퀴즈", icon: "asset/icons/learning/passage-ox.svg", correct: 2, total: 3 },
  { label: "객관식", icon: "asset/icons/learning/passage-mc.svg", correct: 2, total: 3 },
];
const BOTTOM_SHEET_TRANSITION_MS = 320;
const LETTER_WRONG_FEEDBACK_MS = 420;
const LEARNING_EXIT_PAGE_IDS = new Set([
  "learning-vocab-card",
  "learning-vocab-matching",
  "learning-vocab-letter",
  "learning-vocab-mc",
  "learning-passage-cloze",
  "learning-passage-ox",
  "learning-passage-mc",
]);

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCurriculum(lesson) {
  return `${lesson.grade}학년 ${lesson.semester}학기 ${lesson.round}회차 [${lesson.subject}]`;
}

function formatLessonRound(lesson) {
  return `${lesson.grade}학년 ${lesson.semester}학기 ${lesson.round}회차`;
}

function formatDateLabel(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day} 완료`;
}

function highlightWord(text, word) {
  if (!text || !word || !text.includes(word)) {
    return escapeHtml(text);
  }

  const safeWord = escapeHtml(word);
  return escapeHtml(text).replaceAll(safeWord, `<span class="word-card__emphasis">${safeWord}</span>`);
}

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

function highlightExample(text = "", word = "") {
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
    return `${escapeHtml(before)}<span class="word-card__emphasis">${escapeHtml(match)}</span>${escapeHtml(after)}`;
  }

  return escapeHtml(raw);
}

function setTheme(theme) {
  document.body.classList.toggle("theme-light", theme === "light");
  document.body.classList.toggle("theme-dark", theme === "dark");
  const toggle = document.querySelector("[data-theme-toggle]");
  if (toggle) {
    toggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  }
}

function openBottomSheet(sheet) {
  if (!sheet) {
    return;
  }

  sheet.hidden = false;
  requestAnimationFrame(() => {
    sheet.classList.add("is-open");
  });
}

function closeBottomSheet(sheet) {
  if (!sheet) {
    return;
  }

  sheet.classList.remove("is-open");
  window.setTimeout(() => {
    if (!sheet.classList.contains("is-open")) {
      sheet.hidden = true;
    }
  }, BOTTOM_SHEET_TRANSITION_MS);
}

function isInternalLearningHref(href = "") {
  return /^\/?(publish\/|prototype\/pages\/)/.test(href);
}

function normalizeThemeHref(href = "") {
  if (!isInternalLearningHref(href)) {
    return href;
  }

  const [path, hash = ""] = href.split("#");
  const url = new URL(path, window.location.origin);

  if (document.body.classList.contains("theme-dark")) {
    url.searchParams.set("theme", "dark");
  } else {
    url.searchParams.delete("theme");
  }

  return `${url.pathname}${url.search}${hash ? `#${hash}` : ""}`;
}

function updateThemeAwareLinks() {
  document.querySelectorAll("a[href]").forEach((anchor) => {
    if (anchor.dataset.skipThemeLink === "true") {
      return;
    }

    const href = anchor.getAttribute("href") ?? "";
    if (!isInternalLearningHref(href)) {
      return;
    }

    anchor.setAttribute("href", normalizeThemeHref(href));
  });
}

function initTheme() {
  const query = new URLSearchParams(window.location.search);
  const initialTheme = query.get("theme") === "dark" ? "dark" : "light";
  setTheme(initialTheme);
  updateThemeAwareLinks();

  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-theme-toggle]")) {
      return;
    }

    const nextTheme = document.body.classList.contains("theme-dark") ? "light" : "dark";
    setTheme(nextTheme);
    updateThemeAwareLinks();
  });
}

async function applyLessonMeta() {
  const lesson = await getLessonMeta();
  const curriculum = formatCurriculum(lesson);
  document.querySelectorAll("[data-curriculum-label]").forEach((node) => {
    node.textContent = curriculum;
  });
  return lesson;
}

function buildProgressDots(currentIndex, total) {
  const items = [];
  const activeIndex = Math.max(0, Math.min(total - 1, currentIndex - 1));

  for (let index = 0; index < total; index += 1) {
    const stateClass = index < activeIndex ? " is-complete" : index === activeIndex ? " is-active" : "";
    items.push(`<span class="learning-progress__dot${stateClass}"></span>`);
    if (index < total - 1) {
      items.push(`<span class="learning-progress__line${index < activeIndex ? " is-complete" : ""}"></span>`);
    }
  }

  return items.join("");
}

function buildProgressStateMarkup(states = []) {
  return states
    .map((state, index) => {
      const dotClass = state === "complete" ? " is-complete" : state === "active" ? " is-active" : "";
      const lineClass = state === "complete" ? " is-complete" : "";
      return `
        <span class="learning-progress__dot${dotClass}"></span>
        ${index < states.length - 1 ? `<span class="learning-progress__line${lineClass}"></span>` : ""}
      `;
    })
    .join("");
}

function hrefWithTheme(path) {
  const isDark = document.body.classList.contains("theme-dark");
  if (!isDark) {
    return path;
  }

  return `${path}${path.includes("?") ? "&" : "?"}theme=dark`;
}

function pageHref(page) {
  return pageMode === "prototype" ? `/prototype/pages/${page}.html` : `/publish/${page}.html`;
}

function buildLearningExitModal() {
  return `
    <section class="learning-exit-modal" hidden data-learning-exit-modal>
      <div class="learning-exit-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="learning-exit-title" aria-describedby="learning-exit-copy">
        <h2 class="learning-exit-modal__title" id="learning-exit-title">학습을 나가시겠어요?</h2>
        <p class="learning-exit-modal__copy" id="learning-exit-copy">지금 나가면 현재 학습 내용은 저장되지 않고, 다시 시작할 때는 처음부터 학습하게 됩니다.</p>
        <div class="learning-exit-modal__actions">
          <button class="learning-exit-modal__button learning-exit-modal__button--cancel" type="button" data-learning-exit-cancel>아니오</button>
          <button class="learning-exit-modal__button learning-exit-modal__button--confirm" type="button" data-learning-exit-confirm>예</button>
        </div>
      </div>
    </section>
  `;
}

function initLearningExitModal() {
  if (!LEARNING_EXIT_PAGE_IDS.has(pageId)) {
    return;
  }

  const backLink = document.querySelector(".learning-header__left .learning-icon-button");
  if (!backLink) {
    return;
  }

  backLink.dataset.learningExitTrigger = "true";
  backLink.dataset.skipThemeLink = "true";
  backLink.setAttribute("href", normalizeThemeHref(pageHref("home")));
  document.body.insertAdjacentHTML("beforeend", buildLearningExitModal());

  const modal = document.querySelector("[data-learning-exit-modal]");
  const dialog = modal?.querySelector(".learning-exit-modal__dialog");

  function openModal() {
    if (modal) {
      modal.hidden = false;
    }
  }

  function closeModal() {
    if (modal) {
      modal.hidden = true;
    }
  }

  document.addEventListener("click", (event) => {
    const exitTrigger = event.target.closest("[data-learning-exit-trigger]");
    if (exitTrigger) {
      event.preventDefault();
      openModal();
      return;
    }

    if (event.target.closest("[data-learning-exit-cancel]")) {
      event.preventDefault();
      closeModal();
      return;
    }

    if (event.target.closest("[data-learning-exit-confirm]")) {
      event.preventDefault();
      window.location.replace(hrefWithTheme(pageHref("home")));
      return;
    }

    if (!modal?.hidden && dialog && !dialog.contains(event.target)) {
      closeModal();
    }
  });
}

function setBottomSheetStatus(node, text) {
  if (!node) {
    return;
  }

  node.innerHTML = `
    <img src="asset/icons/common/rocket.svg" alt="" />
    <span>${escapeHtml(text)}</span>
  `;
}

function setBottomSheetCopy(node, text = "") {
  if (!node) {
    return;
  }

  node.textContent = text;
  node.hidden = !text;
}

function highlightMeaningSound(text = "") {
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

function buildHanjaModalRowsMarkup(source) {
  return getHanjaCharacterRows(source)
    .map((entry) => {
      const meta = [
        entry.radical ? `<div class="hanja-modal__meta-row"><span>부수</span><strong>${escapeHtml(entry.radical)}</strong></div>` : "",
        entry.totalStrokes ? `<div class="hanja-modal__meta-row"><span>총 획수</span><strong>${escapeHtml(entry.totalStrokes)}</strong></div>` : "",
        entry.strokesExceptRadical
          ? `<div class="hanja-modal__meta-row"><span>부수 외 획수</span><strong>${escapeHtml(entry.strokesExceptRadical)}</strong></div>`
          : "",
      ]
        .filter(Boolean)
        .join("");

      return `
        <article class="hanja-modal__item">
          <div class="hanja-modal__glyph-group">
            <p class="hanja-modal__glyph">${escapeHtml(entry.char)}</p>
            <p class="hanja-modal__meaning-sound">${highlightMeaningSound(entry.meaningSound)}</p>
          </div>
          ${meta ? `<div class="hanja-modal__meta">${meta}</div>` : ""}
        </article>
      `;
    })
    .join("");
}

function openHanjaModal(elements, source, wordLabel = source?.word ?? "") {
  if (!elements?.modal || !elements?.modalWord || !elements?.hanjaList) {
    return false;
  }

  const rows = getHanjaCharacterRows(source);
  if (!rows.length) {
    return false;
  }

  elements.modalWord.textContent = wordLabel;
  elements.hanjaList.innerHTML = buildHanjaModalRowsMarkup(source);
  elements.modal.hidden = false;
  return true;
}

function closeHanjaModal(elements) {
  if (!elements?.modal) {
    return;
  }

  elements.modal.hidden = true;
}

function formatScoreMarkup(correct, total) {
  return `<span class="complete-card__score-current">${correct}</span><span class="complete-card__score-total">/${total}</span>`;
}

function getExampleHighlightTarget(word = {}) {
  if (!word.word) {
    return "";
  }

  if (word.word.endsWith("하다")) {
    return word.word.slice(0, -2);
  }

  if (word.word.endsWith("되다")) {
    return word.word.slice(0, -2);
  }

  return word.word;
}

function isLongText(text) {
  return String(text).length > 34;
}

function createRevealButton(kind, index, text, revealed, word, label) {
  const longClass = isLongText(text) ? " word-card__reveal-item--long" : "";
  const revealedClass = revealed ? " is-revealed" : "";
  const copy = kind === "meaning" ? highlightWord(text, word) : highlightExample(text, word);

  return `
    <button class="word-card__reveal-item${longClass}${revealedClass}" type="button" data-reveal-kind="${kind}" data-reveal-index="${index}">
      <span class="word-card__reveal-copy${kind === "meaning" ? " word-card__reveal-copy--meaning" : ""}">${copy}</span>
      <span class="word-card__reveal-overlay" aria-hidden="true">
        ${TAP_ICON}
        <span>${label}</span>
      </span>
    </button>
  `;
}

async function initVocabCard() {
  const deck = await getVocabCardDeck();
  if (!deck.length) {
    return;
  }

  const state = {
    activeIndex: 0,
    pointerStartX: null,
    pointerStartY: null,
    pointerId: null,
    pointerMode: "idle",
    allowSwipe: false,
    dragOffset: 0,
    ignoreClickUntil: 0,
    cardStates: deck.map((card) => ({
      meaningRevealed: false,
      revealedExamples: new Set(),
      hasHanjaRows: getHanjaCharacterRows(card).length > 0,
      face: "back",
      scrollTop: 0,
    })),
  };

  const elements = {
    paginationCurrent: document.querySelector("[data-pagination-current]"),
    paginationTotal: document.querySelector("[data-pagination-total]"),
    footerCta: document.querySelector("[data-footer-cta]"),
    viewport: document.querySelector("[data-card-viewport]"),
    track: document.querySelector("[data-card-track]"),
    modal: document.querySelector("[data-hanja-modal]"),
    modalWord: document.querySelector("[data-modal-word]"),
    hanjaList: document.querySelector("[data-hanja-list]"),
  };

  function cardState(index) {
    return state.cardStates[index];
  }

  function currentReady() {
    const current = cardState(state.activeIndex);
    const card = deck[state.activeIndex];
    return current.meaningRevealed && card.examples.every((_, index) => current.revealedExamples.has(index));
  }

  function allCardsReady() {
    return deck.every((card, index) => {
      const current = cardState(index);
      return current.meaningRevealed && card.examples.every((_, exampleIndex) => current.revealedExamples.has(exampleIndex));
    });
  }

  function canMoveNext() {
    return state.activeIndex < deck.length - 1 && currentReady();
  }

  function canMovePrev() {
    return state.activeIndex > 0;
  }

  function updateReadyState() {
    const ready = allCardsReady();
    elements.footerCta.classList.toggle("is-ready", ready);
    elements.footerCta.setAttribute("aria-disabled", ready ? "false" : "true");
  }

  function positionTrack() {
    const firstCard = elements.track.querySelector(".word-card-proto-card");
    if (!firstCard) {
      return;
    }

    const gap = parseFloat(getComputedStyle(elements.track).gap || "12");
    const step = firstCard.offsetWidth + gap;
    const baseOffset = (elements.viewport.clientWidth - firstCard.offsetWidth) / 2;
    const translateX = baseOffset - state.activeIndex * step + state.dragOffset;
    elements.track.style.transform = `translate3d(${translateX}px, 0, 0)`;
  }

  function getCardElement(index) {
    return elements.track.querySelector(`[data-card-index="${index}"]`);
  }

  function rememberCardScroll(index = state.activeIndex) {
    const sections = getCardElement(index)?.querySelector(".word-card__sections");
    if (sections) {
      cardState(index).scrollTop = sections.scrollTop;
    }
  }

  function restoreVisibleCardScroll() {
    elements.track.querySelectorAll("[data-card-index]").forEach((cardNode) => {
      const index = Number(cardNode.dataset.cardIndex);
      const sections = cardNode.querySelector(".word-card__sections");
      if (sections) {
        sections.scrollTop = cardState(index).scrollTop || 0;
      }
    });
  }

  function shouldAllowSwipeGesture(target) {
    if (cardState(state.activeIndex).face === "back") {
      return true;
    }

    return !target.closest("[data-reveal-kind], [data-hanja-open], .word-card__info");
  }

  function buildCardMarkup(card, index) {
    const relative = index - state.activeIndex;
    const classes = ["word-card-proto-card"];
    const current = cardState(index);
    if (current.face === "front") {
      classes.push("is-front-visible");
    }

    if (relative === 0) {
      classes.push("is-active");
    } else if (relative === -1) {
      classes.push("is-prev");
    } else if (relative === 1) {
      classes.push("is-next");
      if (currentReady()) {
        classes.push("is-move-hint");
      } else {
        classes.push("is-locked-next");
      }
    } else {
      classes.push("is-distant");
    }

    const showInfoButton = getHanjaCharacterRows(card).length > 0;

    return `
      <article class="${classes.join(" ")}" data-card-index="${index}" aria-current="${relative === 0 ? "true" : "false"}">
        <div class="word-card__inner">
          <div class="word-card__face word-card__face--back" aria-hidden="true"></div>
          <div class="word-card__face word-card__face--front">
            <div class="word-card__header">
              <h1 class="word-card__word">${escapeHtml(card.word)}</h1>
              <div class="word-card__sub">
                ${card.hanja ? `<span class="word-card__hanja">${escapeHtml(card.hanja)}</span>` : ""}
                ${showInfoButton ? `<button class="word-card__info" type="button" aria-label="한자 상세 보기" data-hanja-open="${index}"><img src="asset/ico_card-info.svg" alt="" /></button>` : ""}
              </div>
            </div>
            <div class="word-card__body">
              <div class="word-card__sections">
                <section class="word-card__section">
                  <h2 class="word-card__section-title">뜻</h2>
                  <div>${createRevealButton("meaning", 0, card.meaning, current.meaningRevealed, card.word, "탭해서 뜻 보기")}</div>
                </section>
                <section class="word-card__section">
                  <h2 class="word-card__section-title">예문</h2>
                  <div class="word-card__reveal-list">
                    ${card.examples
                      .map((example, exampleIndex) =>
                        createRevealButton(
                          "example",
                          exampleIndex,
                          example,
                          current.revealedExamples.has(exampleIndex),
                          card.word,
                          "탭해서 예문 보기",
                        ),
                      )
                      .join("")}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function openModal() {
    const card = deck[state.activeIndex];
    if (!openHanjaModal(elements, card, card.word)) {
      return;
    }
  }

  function closeModal() {
    closeHanjaModal(elements);
  }

  function renderCard() {
    elements.track.innerHTML = deck.map((card, index) => buildCardMarkup(card, index)).join("");
    elements.paginationCurrent.textContent = String(state.activeIndex + 1);
    elements.paginationTotal.textContent = String(deck.length);
    updateReadyState();
    restoreVisibleCardScroll();
    positionTrack();
  }

  function move(direction) {
    rememberCardScroll(state.activeIndex);

    if (direction === "next") {
      if (!canMoveNext()) {
        return;
      }
      state.activeIndex += 1;
    } else {
      if (!canMovePrev()) {
        return;
      }
      state.activeIndex -= 1;
    }

    state.dragOffset = 0;
    closeModal();
    renderCard();
  }

  function flipCardToFront(index, cardElement) {
    if (cardState(index).face === "front") {
      return;
    }

    cardState(index).face = "front";

    const activeCard = cardElement || elements.track.querySelector(`[data-card-index="${index}"]`);
    if (!activeCard) {
      renderCard();
      return;
    }

    requestAnimationFrame(() => {
      // Force a layout read so the first flip animates consistently on mobile browsers.
      void activeCard.offsetWidth;
      activeCard.classList.add("is-front-visible");
    });
  }

  function reveal(kind, index) {
    if (cardState(state.activeIndex).face !== "front") {
      return;
    }

    rememberCardScroll(state.activeIndex);
    const current = cardState(state.activeIndex);
    if (kind === "meaning") {
      current.meaningRevealed = true;
    } else {
      deck[state.activeIndex].examples.forEach((_, exampleIndex) => {
        current.revealedExamples.add(exampleIndex);
      });
    }
    renderCard();
  }

  document.addEventListener("click", (event) => {
    const revealButton = event.target.closest("[data-reveal-kind]");
    if (revealButton) {
      reveal(revealButton.dataset.revealKind, Number(revealButton.dataset.revealIndex || 0));
      return;
    }

    if (event.target.closest("[data-hanja-open]")) {
      openModal();
      return;
    }

    if (event.target.closest("[data-hanja-close]")) {
      closeModal();
      return;
    }

    const card = event.target.closest("[data-card-index]");
    if (card && Date.now() >= state.ignoreClickUntil) {
      const index = Number(card.dataset.cardIndex);

      if (index === state.activeIndex) {
        if (cardState(index).face === "back" && !event.target.closest("[data-reveal-kind]")) {
          flipCardToFront(index, card);
        }
        return;
      }

      if (index === state.activeIndex - 1) {
        move("prev");
        return;
      }

      if (index === state.activeIndex + 1) {
        move("next");
      }
      return;
    }

    if (event.target.closest("[data-footer-cta]")) {
      if (elements.footerCta.getAttribute("aria-disabled") === "true") {
        return;
      }

      window.location.href = hrefWithTheme(pageHref("learning-vocab-matching"));
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
      return;
    }
    if (event.key === "ArrowLeft") {
      move("prev");
      return;
    }
    if (event.key === "ArrowRight") {
      move("next");
    }
  });

  elements.viewport.addEventListener("pointerdown", (event) => {
    const activeCard = event.target.closest(`[data-card-index="${state.activeIndex}"]`);
    if (!activeCard) {
      return;
    }

    state.pointerStartX = event.clientX;
    state.pointerStartY = event.clientY;
    state.pointerId = event.pointerId;
    state.pointerMode = "pending";
    state.allowSwipe = shouldAllowSwipeGesture(event.target);
    state.dragOffset = 0;
  });

  elements.viewport.addEventListener("pointermove", (event) => {
    if (state.pointerId !== event.pointerId || state.pointerStartX === null || state.pointerStartY === null) {
      return;
    }

    if (!state.allowSwipe) {
      return;
    }

    const deltaX = event.clientX - state.pointerStartX;
    const deltaY = event.clientY - state.pointerStartY;

    if (state.pointerMode === "pending") {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) {
        return;
      }

      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        resetPointer();
        return;
      }

      state.pointerMode = "swipe";
      elements.track.classList.add("is-dragging");
      getCardElement(state.activeIndex)?.setPointerCapture(event.pointerId);
    }

    if (state.pointerMode !== "swipe") {
      return;
    }

    event.preventDefault();

    if ((deltaX < 0 && !canMoveNext()) || (deltaX > 0 && !canMovePrev())) {
      state.dragOffset = deltaX * 0.24;
    } else {
      state.dragOffset = Math.max(-64, Math.min(64, deltaX));
    }
    positionTrack();
  });

  function resetPointer() {
    elements.track.classList.remove("is-dragging");
    state.pointerStartX = null;
    state.pointerStartY = null;
    state.pointerId = null;
    state.pointerMode = "idle";
    state.allowSwipe = false;
    state.dragOffset = 0;
    positionTrack();
  }

  elements.viewport.addEventListener("pointerup", (event) => {
    if (state.pointerId !== event.pointerId || state.pointerStartX === null) {
      return;
    }

    const wasSwiping = state.pointerMode === "swipe";
    const delta = event.clientX - state.pointerStartX;
    resetPointer();

    if (!wasSwiping) {
      return;
    }

    if (delta <= -34) {
      state.ignoreClickUntil = Date.now() + 240;
      move("next");
    } else if (delta >= 34) {
      state.ignoreClickUntil = Date.now() + 240;
      move("prev");
    }
  });

  elements.viewport.addEventListener("pointercancel", resetPointer);

  renderCard();

  const query = new URLSearchParams(window.location.search);
  if (query.get("modal") === "hanja") {
    openModal();
  }
}

async function initVocabMatching() {
  const pairs = await getVocabMatchingPairs();
  const board = document.querySelector("[data-matching-board]");
  const wordsRoot = document.querySelector("[data-matching-words]");
  const meaningsRoot = document.querySelector("[data-matching-meanings]");
  const svg = document.querySelector("[data-matching-lines]");
  const footerCta = document.querySelector("[data-footer-cta]");
  if (!board || !wordsRoot || !meaningsRoot || !svg || !footerCta) {
    return;
  }

  const rightOrder = [2, 0, 3, 1].filter((index) => pairs[index]);
  const orderedMeanings = rightOrder.map((index) => pairs[index]);
  const pairColorVars = [
    "var(--learning-status-success)",
    "var(--learning-matching-pair-a)",
    "var(--learning-matching-pair-b)",
    "var(--learning-brand-secondary)",
  ];
  const pairColorById = new Map(
    pairs.map((pair, index) => [pair.id, pairColorVars[index % pairColorVars.length]]),
  );
  const state = {
    animatedLineIds: new Set(),
    matchedIds: new Set(),
    selectedWordId: null,
    selectedMeaningId: null,
  };
  let errorTimer = null;
  let resizeRaf = 0;

  function isComplete() {
    return state.matchedIds.size === pairs.length;
  }

  function updateFooterState() {
    const ready = isComplete();
    footerCta.classList.toggle("is-ready", ready);
    footerCta.setAttribute("aria-disabled", ready ? "false" : "true");
  }

  wordsRoot.innerHTML = pairs
    .map(
      (pair) => `
        <button class="matching-pill" type="button" data-word-id="${pair.id}" style="--matching-pair-color: ${pairColorById.get(pair.id)};">
          <span class="matching-pill__body">
            <span class="matching-pill__label">${escapeHtml(pair.word)}</span>
          </span>
          <span class="matching-pill__dot" aria-hidden="true"></span>
        </button>
      `,
    )
    .join("");

  meaningsRoot.innerHTML = orderedMeanings
    .map(
      (pair) => `
        <button class="matching-meaning" type="button" data-meaning-id="${pair.id}" style="--matching-pair-color: ${pairColorById.get(pair.id)};">
          <span class="matching-meaning__dot" aria-hidden="true"></span>
          <span class="matching-meaning__body">
            <span class="matching-meaning__label">${escapeHtml(pair.meaning)}</span>
          </span>
        </button>
      `,
    )
    .join("");

  function clearSelection() {
    state.selectedWordId = null;
    state.selectedMeaningId = null;
  }

  function drawLines() {
    const boardRect = board.getBoundingClientRect();
    const width = Math.max(1, Math.round(boardRect.width));
    const height = Math.max(1, Math.round(boardRect.height));
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const lines = Array.from(state.matchedIds)
      .map((id) => {
        const wordDot = wordsRoot.querySelector(`[data-word-id="${id}"] .matching-pill__dot`);
        const meaningDot = meaningsRoot.querySelector(`[data-meaning-id="${id}"] .matching-meaning__dot`);
        if (!wordDot || !meaningDot) {
          return "";
        }

        const wordRect = wordDot.getBoundingClientRect();
        const meaningRect = meaningDot.getBoundingClientRect();
        const x1 = wordRect.left - boardRect.left + wordRect.width / 2;
        const y1 = wordRect.top - boardRect.top + wordRect.height / 2;
        const x2 = meaningRect.left - boardRect.left + meaningRect.width / 2;
        const y2 = meaningRect.top - boardRect.top + meaningRect.height / 2;
        const midX = (x1 + x2) / 2;
        const lineColor = pairColorById.get(id) ?? "var(--learning-status-success)";

        return `<path class="matching-board__line" data-line-id="${id}" style="--matching-line-color: ${lineColor};" d="M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}" />`;
      })
      .join("");

    svg.innerHTML = lines;
    svg.querySelectorAll(".matching-board__line").forEach((path) => {
      const lineId = path.dataset.lineId;
      const length = path.getTotalLength();
      path.style.setProperty("--matching-line-length", String(length));
      if (lineId && !state.animatedLineIds.has(lineId)) {
        path.classList.add("is-drawing");
        state.animatedLineIds.add(lineId);
      }
    });
  }

  function render() {
    wordsRoot.querySelectorAll("[data-word-id]").forEach((node) => {
      const id = node.dataset.wordId;
      node.classList.toggle("is-active", id === state.selectedWordId);
      node.classList.toggle("is-matched", state.matchedIds.has(id));
      node.classList.toggle(
        "is-outfocused",
        !!state.selectedWordId && id !== state.selectedWordId && !state.matchedIds.has(id),
      );
    });

    meaningsRoot.querySelectorAll("[data-meaning-id]").forEach((node) => {
      const id = node.dataset.meaningId;
      node.classList.toggle("is-active", id === state.selectedMeaningId);
      node.classList.toggle("is-matched", state.matchedIds.has(id));
      node.classList.toggle(
        "is-outfocused",
        !!state.selectedMeaningId && id !== state.selectedMeaningId && !state.matchedIds.has(id),
      );
    });

    updateFooterState();
    drawLines();
  }

  function setError(wordId, meaningId) {
    window.clearTimeout(errorTimer);
    const word = wordsRoot.querySelector(`[data-word-id="${wordId}"]`);
    const meaning = meaningsRoot.querySelector(`[data-meaning-id="${meaningId}"]`);
    word?.classList.add("is-error");
    meaning?.classList.add("is-error");
    errorTimer = window.setTimeout(() => {
      word?.classList.remove("is-error");
      meaning?.classList.remove("is-error");
      clearSelection();
      render();
    }, 360);
  }

  function commitMatch(wordId) {
    state.matchedIds.add(wordId);
    clearSelection();
    render();
  }

  function tryMatch(wordId, meaningId) {
    if (!wordId || !meaningId) {
      return;
    }

    if (wordId === meaningId) {
      commitMatch(wordId);
      return;
    }

    setError(wordId, meaningId);
  }

  function handleWordSelect(wordId) {
    if (state.matchedIds.has(wordId)) {
      return;
    }

    if (state.selectedWordId && state.selectedWordId !== wordId) {
      clearSelection();
      render();
      return;
    }

    if (state.selectedMeaningId) {
      tryMatch(wordId, state.selectedMeaningId);
      return;
    }

    state.selectedWordId = state.selectedWordId === wordId ? null : wordId;
    render();
  }

  function handleMeaningSelect(meaningId) {
    if (state.matchedIds.has(meaningId)) {
      return;
    }

    if (state.selectedMeaningId && state.selectedMeaningId !== meaningId) {
      clearSelection();
      render();
      return;
    }

    if (state.selectedWordId) {
      tryMatch(state.selectedWordId, meaningId);
      return;
    }

    state.selectedMeaningId = state.selectedMeaningId === meaningId ? null : meaningId;
    render();
  }

  document.addEventListener("click", (event) => {
    const wordButton = event.target.closest("[data-word-id]");
    if (wordButton && wordsRoot.contains(wordButton)) {
      handleWordSelect(wordButton.dataset.wordId);
      return;
    }

    const meaningButton = event.target.closest("[data-meaning-id]");
    if (meaningButton && meaningsRoot.contains(meaningButton)) {
      handleMeaningSelect(meaningButton.dataset.meaningId);
      return;
    }

    if (event.target.closest("[data-footer-cta]")) {
      if (footerCta.getAttribute("aria-disabled") === "true") {
        return;
      }

      window.location.href = hrefWithTheme(pageHref("learning-vocab-letter"));
      return;
    }

    if (state.selectedWordId || state.selectedMeaningId) {
      clearSelection();
      render();
    }
  });

  const refreshLines = () => {
    window.cancelAnimationFrame(resizeRaf);
    resizeRaf = window.requestAnimationFrame(() => {
      render();
    });
  };

  window.addEventListener("resize", refreshLines);
  window.addEventListener("orientationchange", refreshLines);
  document.fonts?.ready?.then(refreshLines);

  const resizeObserver = new ResizeObserver(refreshLines);
  resizeObserver.observe(board);

  render();
}

async function initVocabLetter() {
  const query = new URLSearchParams(window.location.search);
  const lesson = await getLessonMeta();
  const variant =
    query.get("variant") === "lower"
      ? "lowerGrade"
      : query.get("variant") === "upper"
        ? "upperGrade"
        : lesson.grade >= 3
          ? "upperGrade"
          : "lowerGrade";
  const questions = await getVocabLetterSet(variant);
  if (!questions.length) {
    return;
  }
  const isUpperGrade = variant === "upperGrade";

  const title = document.querySelector("[data-letter-title]");
  const description = document.querySelector("[data-letter-description]");
  const progress = document.querySelector("[data-letter-progress]");
  const card = document.querySelector("[data-letter-card]");
  const meaningReveal = document.querySelector("[data-letter-meaning-reveal]");
  const solvedMeaning = document.querySelector("[data-letter-solved-meaning]");
  const tiles = document.querySelector("[data-letter-tiles]");
  const sheet = document.querySelector("[data-letter-sheet]");
  const sheetCopy = document.querySelector("[data-letter-sheet-copy]");
  const sheetCta = document.querySelector("[data-letter-sheet-cta]");

  const state = {
    currentIndex: 0,
    mode: "problem",
    pickedTileIndexes: [],
  };
  let wrongResetTimer = null;

  function normalizeQuestion(question) {
    const answerText = question.answerText ?? question.answer ?? "";
    const answerUnits = Array.from(answerText);
    const layout = question.promptType === "sentence" || typeof question.sentenceBefore === "string" ? "sentence" : "meaning";

    if (layout === "sentence") {
      return {
        id: question.id,
        layout,
        answerUnits,
        hints: question.initials ?? [],
        sentenceBefore: question.sentenceBefore ?? "",
        sentenceAfter: question.sentenceAfter ?? "",
        meaning: question.meaning ?? "",
        tiles: question.tiles ?? [],
      };
    }

    return {
      id: question.id,
      layout,
      answerUnits,
      hints: question.initials ?? [],
      meaning: question.prompt ?? question.meaning ?? "",
      tiles: question.tiles ?? [],
    };
  }

  function currentQuestion() {
    return normalizeQuestion(questions[state.currentIndex]);
  }

  function selectedValues() {
    const current = currentQuestion();
    return state.pickedTileIndexes.map((index) => current.tiles[index]);
  }

  function buildProgressStates() {
    return questions.map((_, index) => {
      if (index < state.currentIndex) {
        return "complete";
      }

      if (index === state.currentIndex) {
        return state.mode === "correct" ? "complete" : "active";
      }

      return "inactive";
    });
  }

  function buildBlanksMarkup(question) {
    const values = state.mode === "correct" ? question.answerUnits : selectedValues();
    return question.answerUnits
      .map((_, index) => {
        const value = values[index] ?? "";
        const hint = !value && question.hints?.[index] ? `<span class="letter-blank__hint">${escapeHtml(question.hints[index])}</span>` : "";
        const filledClass = value ? " is-filled" : "";
        const wrongClass = state.mode === "wrong" && value ? " is-wrong is-shaking" : "";
        const interactiveSlot = value && state.mode === "problem" ? `data-letter-slot="${index}"` : "";
        return `<span class="letter-blank${filledClass}${wrongClass}" ${interactiveSlot}>${value ? escapeHtml(value) : hint}</span>`;
      })
      .join("");
  }

  function buildCardMarkup(question) {
    if (question.layout === "sentence") {
      return `
        <div class="letter-question-card__sentence">
          <span class="letter-question-card__sentence-copy">${escapeHtml(question.sentenceBefore)}</span>
          <span class="letter-blanks">${buildBlanksMarkup(question)}</span>
          <span class="letter-question-card__sentence-copy letter-question-card__sentence-copy--post">${escapeHtml(question.sentenceAfter)}</span>
        </div>
      `;
    }

    return `
      <div class="letter-question-card__stack">
        <div class="letter-blanks">${buildBlanksMarkup(question)}</div>
        <p class="letter-meaning">${escapeHtml(question.meaning)}</p>
      </div>
    `;
  }

  function renderTiles(question) {
    if (state.mode === "correct") {
      tiles.innerHTML = "";
      tiles.hidden = true;
      return;
    }

    tiles.hidden = false;
    tiles.innerHTML = question.tiles
      .map((tile, index) => {
        const used = state.pickedTileIndexes.includes(index);
        const wrongClass = state.mode === "wrong" && used ? " is-wrong is-shaking" : "";
        return `
          <button class="letter-tile${used ? " is-used" : ""}${wrongClass}" type="button" data-letter-tile="${index}" ${used ? "disabled" : ""}>
            ${escapeHtml(tile)}
          </button>
        `;
      })
      .join("");
  }

  function render() {
    const question = currentQuestion();
    title.textContent = "글자 맞추기";
    description.textContent = "글자를 눌러 단어를 완성해요.";
    progress.innerHTML = buildProgressStateMarkup(buildProgressStates());

    card.classList.toggle("letter-question-card--lower", question.layout === "meaning");
    card.innerHTML = buildCardMarkup(question);

    solvedMeaning.textContent = question.meaning ?? "";
    meaningReveal.hidden = !(state.mode === "correct" && isUpperGrade);

    sheetCta.textContent = state.currentIndex === questions.length - 1 ? "다음 학습으로" : "다음 문제";
    sheetCopy.hidden = true;
    sheetCopy.textContent = "";

    renderTiles(question);

    if (state.mode === "correct") {
      openBottomSheet(sheet);
    } else {
      closeBottomSheet(sheet);
    }
  }

  function clearWrongResetTimer() {
    window.clearTimeout(wrongResetTimer);
    wrongResetTimer = null;
  }

  function resetAfterWrongAnswer() {
    clearWrongResetTimer();
    state.mode = "problem";
    state.pickedTileIndexes = [];
    render();
  }

  function tryComplete() {
    const question = currentQuestion();
    if (state.pickedTileIndexes.length !== question.answerUnits.length) {
      return;
    }

    const answer = selectedValues().join("");
    if (answer === question.answerUnits.join("")) {
      clearWrongResetTimer();
      state.mode = "correct";
      render();
      return;
    }

    state.mode = "wrong";
    render();
    wrongResetTimer = window.setTimeout(() => {
      resetAfterWrongAnswer();
    }, LETTER_WRONG_FEEDBACK_MS);
  }

  document.addEventListener("click", (event) => {
    const tileButton = event.target.closest("[data-letter-tile]");
    if (tileButton && tiles.contains(tileButton) && state.mode === "problem") {
      if (state.pickedTileIndexes.length >= currentQuestion().answerUnits.length) {
        return;
      }

      state.pickedTileIndexes.push(Number(tileButton.dataset.letterTile));
      render();
      tryComplete();
      return;
    }

    const blankButton = event.target.closest("[data-letter-slot]");
    if (blankButton && card.contains(blankButton) && state.mode === "problem") {
      const slotIndex = Number(blankButton.dataset.letterSlot);
      if (!Number.isNaN(slotIndex)) {
        state.pickedTileIndexes.splice(slotIndex, 1);
      }
      render();
      return;
    }

    if (!event.target.closest("[data-letter-sheet-cta]") || state.mode !== "correct") {
      return;
    }

    if (state.currentIndex < questions.length - 1) {
      state.currentIndex += 1;
      state.mode = "problem";
      state.pickedTileIndexes = [];
      render();
      return;
    }

    window.location.href = hrefWithTheme(pageHref("learning-vocab-mc"));
  });

  render();
}

async function initVocabMc() {
  const questions = await getVocabMeaningQuestions();
  if (!questions.length) {
    return;
  }

  const progress = document.querySelector("[data-mc-progress]");
  const prompt = document.querySelector("[data-mc-question]");
  const options = document.querySelector("[data-mc-options]");
  const sheet = document.querySelector("[data-mc-sheet]");
  const status = document.querySelector("[data-mc-status]");
  const copy = document.querySelector("[data-mc-copy]");
  const cta = document.querySelector("[data-mc-cta]");
  const state = {
    currentIndex: 0,
    solved: false,
    shakingOption: null,
    disabledOptions: new Map(),
  };

  function currentQuestion() {
    return questions[state.currentIndex];
  }

  function disabledSet() {
    if (!state.disabledOptions.has(state.currentIndex)) {
      state.disabledOptions.set(state.currentIndex, new Set());
    }

    return state.disabledOptions.get(state.currentIndex);
  }

  function renderFrame() {
    const question = currentQuestion();
    const isLast = state.currentIndex === questions.length - 1;
    progress.innerHTML = buildProgressStateMarkup(
      questions.map((_, index) => {
        if (index < state.currentIndex) {
          return "complete";
        }
        if (index === state.currentIndex) {
          return state.solved ? "complete" : "active";
        }
        return "";
      }),
    );
    prompt.textContent = question.question;
    cta.textContent = isLast ? "다음 학습으로" : "다음 문제";
    cta.setAttribute("href", isLast ? hrefWithTheme(pageHref("learning-passage-cloze")) : "#");
  }

  function renderOptions() {
    const question = currentQuestion();
    const disabledOptions = disabledSet();
    options.innerHTML = question.options
      .map((option, index) => {
        const classes = ["option-card"];
        let disabled = false;

        if (state.solved) {
          if (option === question.answer) {
            classes.push("is-selected", "is-correct");
          } else {
            classes.push("is-disabled");
            disabled = true;
          }
        } else if (state.shakingOption === option) {
          classes.push("is-selected", "is-wrong", "is-shaking");
        } else if (disabledOptions.has(option)) {
          classes.push("is-disabled");
          disabled = true;
        }

        return `
          <button class="${classes.join(" ")}" type="button" data-mc-option="${index}" ${disabled ? "disabled aria-disabled=\"true\"" : ""}>
            ${escapeHtml(option)}
          </button>
        `;
      })
      .join("");
  }

  function render() {
    renderFrame();
    renderOptions();

    if (state.solved) {
      openBottomSheet(sheet);
    } else {
      closeBottomSheet(sheet);
    }
  }

  document.addEventListener("click", (event) => {
    const ctaButton = event.target.closest("[data-mc-cta]");
    if (ctaButton && sheet.contains(ctaButton)) {
      event.preventDefault();
      if (!state.solved) {
        return;
      }

      if (state.currentIndex < questions.length - 1) {
        state.currentIndex += 1;
        state.solved = false;
        state.shakingOption = null;
        setBottomSheetStatus(status, "");
        setBottomSheetCopy(copy, "");
        render();
        return;
      }

      window.location.href = hrefWithTheme(pageHref("learning-passage-cloze"));
      return;
    }

    const button = event.target.closest("[data-mc-option]");
    if (!button || !options.contains(button) || state.solved || state.shakingOption) {
      return;
    }

    const question = currentQuestion();
    const disabledOptions = disabledSet();
    const option = question.options[Number(button.dataset.mcOption)];
    if (disabledOptions.has(option)) {
      return;
    }

    if (option === question.answer) {
      state.solved = true;
      setBottomSheetStatus(status, question.correctFeedback || "정답!");
      setBottomSheetCopy(copy, "");
      render();
      return;
    }

    state.shakingOption = option;
    renderOptions();

    window.setTimeout(() => {
      disabledOptions.add(option);
      if (state.shakingOption === option) {
        state.shakingOption = null;
      }
      renderOptions();
    }, 420);
  });

  render();
}

async function initPassageCloze() {
  const model = await getPassageClozeModel();
  if (!model) {
    return;
  }

  const title = document.querySelector("[data-passage-title]");
  const flow = document.querySelector("[data-passage-flow]");
  const sheet = document.querySelector("[data-cloze-sheet]");
  const sheetPanel = sheet?.querySelector(".bottom-sheet__panel");
  const optionRoot = document.querySelector("[data-cloze-options]");
  const footerCta = document.querySelector("[data-footer-cta]");
  const fontMinus = document.querySelector("[data-font-minus]");
  const fontPlus = document.querySelector("[data-font-plus]");
  const answers = new Map();
  const feedbackSelections = new Map();
  const disabledOptions = new Map();
  let activeBlankId = null;
  let largeText = false;
  let correctFeedbackTimer = null;

  title.textContent = model.passageTitle;

  function optionsFor(blankId) {
    return model.blanks.find((blank) => blank.id === blankId)?.options ?? [];
  }

  function answerFor(blankId) {
    return model.blanks.find((blank) => blank.id === blankId)?.answer ?? "";
  }

  function disabledOptionSet(blankId) {
    if (!disabledOptions.has(blankId)) {
      disabledOptions.set(blankId, new Set());
    }

    return disabledOptions.get(blankId);
  }

  function renderPassage() {
    flow.classList.toggle("is-large", largeText);
    flow.innerHTML = model.blocks
      .map((block) => {
        if (block.type === "text") {
          return escapeHtml(block.text);
        }

        const selected = answers.get(block.id);
        const answer = answerFor(block.id);
        const activeClass = block.id === activeBlankId ? " is-active" : "";
        const emptyClass = selected ? "" : " is-empty";
        const filledClass = selected ? " is-filled" : "";
        return `<button class="passage-blank${activeClass}${emptyClass}${filledClass}" type="button" data-blank-id="${block.id}"><span class="passage-blank__text${selected ? "" : " is-placeholder"}">${escapeHtml(selected || answer)}</span></button>`;
      })
      .join("");

    const complete = model.blanks.every((blank) => answers.has(blank.id));
    footerCta.classList.toggle("is-ready", complete);
    footerCta.setAttribute("aria-disabled", complete ? "false" : "true");
  }

  function renderOptions() {
    const activeBlank = model.blanks.find((blank) => blank.id === activeBlankId);
    if (!activeBlank) {
      closeBottomSheet(sheet);
      return;
    }

    const feedback = feedbackSelections.get(activeBlankId);
    const solved = answers.has(activeBlankId);
    openBottomSheet(sheet);
    optionRoot.innerHTML = `
      <div class="cloze-options${solved ? " is-filled" : ""}">
        ${optionsFor(activeBlankId)
          .map(
            (option, index) => {
              const isSelected = feedback?.value === option;
              const isDisabled = disabledOptionSet(activeBlankId).has(option);
              const stateClass = `${isSelected ? ` is-selected is-${feedback.result}` : ""}${feedback?.value === option && feedback?.shaking ? " is-shaking" : ""}${isDisabled ? " is-disabled" : ""}`;
              return `
              <button class="option-card${stateClass}" type="button" data-cloze-option="${index}" ${isDisabled ? "disabled aria-disabled=\"true\"" : ""}>
                ${escapeHtml(option)}
              </button>
            `;
            },
          )
          .join("")}
      </div>
    `;
  }

  document.addEventListener("click", (event) => {
    const blank = event.target.closest("[data-blank-id]");
    if (blank && flow.contains(blank)) {
      if (correctFeedbackTimer) {
        window.clearTimeout(correctFeedbackTimer);
        correctFeedbackTimer = null;
      }

      if (activeBlankId === blank.dataset.blankId && !sheet.hidden && sheet.classList.contains("is-open")) {
        activeBlankId = null;
        renderPassage();
        renderOptions();
        return;
      }

      activeBlankId = blank.dataset.blankId;
      renderPassage();
      renderOptions();
      return;
    }

    const option = event.target.closest("[data-cloze-option]");
    if (option && optionRoot.contains(option)) {
      const text = optionsFor(activeBlankId)[Number(option.dataset.clozeOption)];
      if (disabledOptionSet(activeBlankId).has(text)) {
        return;
      }

      const isCorrect = text === answerFor(activeBlankId);
      feedbackSelections.set(activeBlankId, {
        value: text,
        result: isCorrect ? "correct" : "wrong",
        shaking: !isCorrect,
      });

      if (isCorrect) {
        answers.set(activeBlankId, text);
        renderPassage();
        renderOptions();

        const solvedBlankId = activeBlankId;
        correctFeedbackTimer = window.setTimeout(() => {
          if (activeBlankId === solvedBlankId) {
            activeBlankId = null;
            renderPassage();
            renderOptions();
          }
          correctFeedbackTimer = null;
        }, 720);
      } else {
        answers.delete(activeBlankId);
        renderPassage();
        renderOptions();

        const targetBlankId = activeBlankId;
        window.setTimeout(() => {
          disabledOptionSet(targetBlankId).add(text);
          const currentFeedback = feedbackSelections.get(targetBlankId);
          if (currentFeedback?.value === text && currentFeedback?.result === "wrong") {
            feedbackSelections.delete(targetBlankId);
          }
          renderOptions();
        }, 420);
        return;
      }
      return;
    }

    if (event.target.closest("[data-font-minus]")) {
      largeText = false;
      renderPassage();
      return;
    }

    if (event.target.closest("[data-font-plus]")) {
      largeText = true;
      renderPassage();
      return;
    }

    if (event.target.closest("[data-footer-cta]")) {
      if (footerCta.getAttribute("aria-disabled") === "true") {
        return;
      }

      window.location.href = hrefWithTheme(pageHref("learning-passage-ox"));
      return;
    }

    if (sheet.classList.contains("is-open") && sheetPanel && !sheetPanel.contains(event.target)) {
      if (correctFeedbackTimer) {
        window.clearTimeout(correctFeedbackTimer);
        correctFeedbackTimer = null;
      }

      activeBlankId = null;
      renderPassage();
      renderOptions();
    }
  });

  renderPassage();
  renderOptions();
}

async function initPassageOx() {
  const questions = await getPassageOxQuestions();
  if (!questions.length) {
    return;
  }

  const progress = document.querySelector("[data-ox-progress]");
  const prompt = document.querySelector("[data-ox-question]");
  const sheet = document.querySelector("[data-ox-sheet]");
  const status = document.querySelector("[data-ox-status]");
  const copy = document.querySelector("[data-ox-copy]");
  const choices = document.querySelector("[data-ox-choices]");
  const cta = document.querySelector("[data-ox-cta]");
  const state = {
    currentIndex: 0,
    solved: false,
    shakingValue: null,
    disabledValues: new Map(),
  };

  function currentQuestion() {
    return questions[state.currentIndex];
  }

  function disabledSet() {
    if (!state.disabledValues.has(state.currentIndex)) {
      state.disabledValues.set(state.currentIndex, new Set());
    }

    return state.disabledValues.get(state.currentIndex);
  }

  function renderFrame() {
    const question = currentQuestion();
    const isLast = state.currentIndex === questions.length - 1;

    progress.innerHTML = buildProgressDots(state.currentIndex + 1, questions.length);
    prompt.textContent = question.statement;
    cta.textContent = isLast ? "다음 학습으로" : "다음 문제";
    cta.setAttribute("href", isLast ? hrefWithTheme(pageHref("learning-passage-mc")) : "#");
  }

  function renderChoices() {
    const question = currentQuestion();
    const disabledValues = disabledSet();

    choices.querySelectorAll("[data-ox-value]").forEach((node) => {
      const value = node.dataset.oxValue;
      node.classList.remove("is-selected", "is-correct", "is-wrong", "is-disabled", "is-shaking");
      node.removeAttribute("disabled");
      node.removeAttribute("aria-disabled");

      if (state.solved) {
        if (value === question.answer) {
          node.classList.add("is-selected", "is-correct");
        } else {
          node.classList.add("is-disabled");
          node.setAttribute("disabled", "");
          node.setAttribute("aria-disabled", "true");
        }
        return;
      }

      if (state.shakingValue === value) {
        node.classList.add("is-selected", "is-wrong", "is-shaking");
        return;
      }

      if (disabledValues.has(value)) {
        node.classList.add("is-disabled");
        node.setAttribute("disabled", "");
        node.setAttribute("aria-disabled", "true");
      }
    });
  }

  function render() {
    renderFrame();
    renderChoices();

    if (state.solved) {
      openBottomSheet(sheet);
    } else {
      closeBottomSheet(sheet);
    }
  }

  document.addEventListener("click", (event) => {
    const ctaButton = event.target.closest("[data-ox-cta]");
    if (ctaButton && sheet.contains(ctaButton)) {
      event.preventDefault();
      if (!state.solved) {
        return;
      }

      if (state.currentIndex < questions.length - 1) {
        state.currentIndex += 1;
        state.solved = false;
        state.shakingValue = null;
        setBottomSheetStatus(status, "");
        setBottomSheetCopy(copy, "");
        render();
        return;
      }

      window.location.href = hrefWithTheme(pageHref("learning-passage-mc"));
      return;
    }

    const button = event.target.closest("[data-ox-value]");
    if (!button || !choices.contains(button) || state.solved || state.shakingValue) {
      return;
    }

    const question = currentQuestion();
    const disabledValues = disabledSet();
    const value = button.dataset.oxValue;
    if (disabledValues.has(value)) {
      return;
    }

    if (value === question.answer) {
      state.solved = true;
      setBottomSheetStatus(status, "정답!");
      setBottomSheetCopy(copy, question.explanation);
      render();
      return;
    }

    state.shakingValue = value;
    renderChoices();

    window.setTimeout(() => {
      disabledValues.add(value);
      if (state.shakingValue === value) {
        state.shakingValue = null;
      }
      renderChoices();
    }, 420);
  });

  render();
}

async function initPassageMc() {
  const questions = await getPassageMcQuestions();
  if (!questions.length) {
    return;
  }

  const progress = document.querySelector("[data-passage-mc-progress]");
  const prompt = document.querySelector("[data-passage-mc-question]");
  const options = document.querySelector("[data-passage-mc-options]");
  const sheet = document.querySelector("[data-passage-mc-sheet]");
  const status = document.querySelector("[data-passage-mc-status]");
  const copy = document.querySelector("[data-passage-mc-copy]");
  const cta = document.querySelector("[data-passage-mc-cta]");
  const state = {
    currentIndex: 0,
    solved: false,
    shakingOption: null,
    disabledOptions: new Map(),
  };

  function currentQuestion() {
    return questions[state.currentIndex];
  }

  function disabledSet() {
    if (!state.disabledOptions.has(state.currentIndex)) {
      state.disabledOptions.set(state.currentIndex, new Set());
    }

    return state.disabledOptions.get(state.currentIndex);
  }

  function renderFrame() {
    const question = currentQuestion();
    const isLast = state.currentIndex === questions.length - 1;
    progress.innerHTML = buildProgressDots(state.currentIndex + 1, questions.length);
    prompt.textContent = question.question;
    cta.textContent = isLast ? "다음 학습으로" : "다음 문제";
    cta.setAttribute("href", isLast ? hrefWithTheme(pageHref("learning-complete")) : "#");
  }

  function renderOptions() {
    const question = currentQuestion();
    const disabledOptions = disabledSet();
    options.innerHTML = question.options
      .map((option, index) => {
        const classes = ["option-card"];
        let disabled = false;

        if (state.solved) {
          if (option === question.answer) {
            classes.push("is-selected", "is-correct");
          } else {
            classes.push("is-disabled");
            disabled = true;
          }
        } else if (state.shakingOption === option) {
          classes.push("is-selected", "is-wrong", "is-shaking");
        } else if (disabledOptions.has(option)) {
          classes.push("is-disabled");
          disabled = true;
        }

        return `
          <button class="${classes.join(" ")}" type="button" data-passage-mc-option="${index}" ${disabled ? "disabled aria-disabled=\"true\"" : ""}>
            ${escapeHtml(option)}
          </button>
        `;
      })
      .join("");
  }

  function render() {
    renderFrame();
    renderOptions();

    if (state.solved) {
      openBottomSheet(sheet);
    } else {
      closeBottomSheet(sheet);
    }
  }

  document.addEventListener("click", (event) => {
    const ctaButton = event.target.closest("[data-passage-mc-cta]");
    if (ctaButton && sheet.contains(ctaButton)) {
      event.preventDefault();
      if (!state.solved) {
        return;
      }

      if (state.currentIndex < questions.length - 1) {
        state.currentIndex += 1;
        state.solved = false;
        state.shakingOption = null;
        setBottomSheetStatus(status, "");
        setBottomSheetCopy(copy, "");
        render();
        return;
      }

      window.location.href = hrefWithTheme(pageHref("learning-complete"));
      return;
    }

    const button = event.target.closest("[data-passage-mc-option]");
    if (!button || !options.contains(button) || state.solved || state.shakingOption) {
      return;
    }

    const question = currentQuestion();
    const disabledOptions = disabledSet();
    const option = question.options[Number(button.dataset.passageMcOption)];
    if (disabledOptions.has(option)) {
      return;
    }

    if (option === question.answer) {
      state.solved = true;
      setBottomSheetStatus(status, "정답!");
      setBottomSheetCopy(copy, question.explanation || question.answer);
      render();
      return;
    }

    state.shakingOption = option;
    renderOptions();

    window.setTimeout(() => {
      disabledOptions.add(option);
      if (state.shakingOption === option) {
        state.shakingOption = null;
      }
      renderOptions();
    }, 420);
  });

  render();
}

async function initResult() {
  const lesson = await getLessonMeta();
  const vocabulary = await getVocabularyList();
  const query = new URLSearchParams(window.location.search);
  const title = document.querySelector("[data-result-title]");
  const date = document.querySelector("[data-result-date]");
  const backLink = document.querySelector("[data-result-back-link]");
  const stageList = document.querySelector("[data-stage-list]");
  const wrongWords = document.querySelector("[data-wrong-words]");
  const wrongTitle = document.querySelector("[data-result-wrong-title]");
  const tabButtons = document.querySelectorAll("[data-result-tab]");
  const panels = document.querySelectorAll("[data-result-panel]");
  const hanjaModalElements = {
    modal: document.querySelector("[data-hanja-modal]"),
    modalWord: document.querySelector("[data-modal-word]"),
    hanjaList: document.querySelector("[data-hanja-list]"),
  };

  const totalCorrect = LEARNING_STAGE_DATA.reduce((sum, item) => sum + item.correct, 0);
  const totalQuestions = LEARNING_STAGE_DATA.reduce((sum, item) => sum + item.total, 0);
  const totalWrong = totalQuestions - totalCorrect;
  const wrongVocabulary = vocabulary.slice(0, 2);
  const from = query.get("from");
  const backTarget = from === "records" ? "records" : from === "home" ? "home" : "learning-complete";

  title.textContent = formatLessonRound(lesson);
  date.textContent = formatDateLabel();
  const backHref = hrefWithTheme(pageHref(backTarget));
  backLink?.setAttribute("href", backHref);
  document.querySelector("[data-result-correct]").textContent = String(totalCorrect);
  document.querySelector("[data-result-wrong]").textContent = String(totalWrong);
  if (wrongTitle) {
    wrongTitle.innerHTML = `틀린 어휘 <span>${wrongVocabulary.length}개</span>`;
  }

  if (stageList) {
    stageList.classList.add("result-stage-list__items");
  }

  stageList.innerHTML = LEARNING_STAGE_DATA
    .map((item) => {
      const width = `${(item.correct / item.total) * 100}%`;
      return `
        <article class="learning-card result-stage-item">
          <span class="result-stage-item__icon"><img src="${item.icon}" alt="" /></span>
          <div class="result-stage-item__body">
            <div class="result-stage-item__row">
              <span class="result-stage-item__name">${escapeHtml(item.label)}</span>
              <span class="result-stage-item__score">${item.correct}/${item.total}</span>
            </div>
            <div class="result-stage-item__bar"><span style="width: ${width};"></span></div>
          </div>
        </article>
      `;
    })
    .join("");

  wrongWords.innerHTML = wrongVocabulary
    .map((word) => {
      const target = getExampleHighlightTarget(word);
      const examples = (word.examples || [])
        .slice(0, 3)
        .map(
          (example) => `
            <div class="wrong-word-card__example-row">
              <span class="wrong-word-card__bullet" aria-hidden="true">✦</span>
              <p class="wrong-word-card__example">${highlightWord(example, target)}</p>
            </div>
          `,
        )
        .join("");
      const hasHanjaRows = getHanjaCharacterRows(word).length > 0;
      return `
        <article class="learning-card wrong-word-card">
          <div class="wrong-word-card__word">
            <h2 class="wrong-word-card__title">${escapeHtml(word.word)}</h2>
            ${
              word.hanja
                ? hasHanjaRows
                  ? `<button class="wrong-word-card__hanja" type="button" data-result-hanja-open="${escapeHtml(word.id)}" aria-label="${escapeHtml(
                      `${word.word} 한자 상세 보기`,
                    )}">${escapeHtml(word.hanja)}<img src="asset/ico_card-info.svg" alt="" /></button>`
                  : `<div class="wrong-word-card__hanja">${escapeHtml(word.hanja)}<img src="asset/ico_card-info.svg" alt="" /></div>`
                : ""
            }
            <p class="wrong-word-card__meaning">${escapeHtml(word.meaning)}</p>
          </div>
          <div class="wrong-word-card__examples">
            <span class="wrong-word-card__tag">예문</span>
            ${examples}
          </div>
        </article>
      `;
    })
    .join("");

  function setActiveResultTab(target) {
    tabButtons.forEach((node) => {
      node.classList.toggle("is-active", node.dataset.resultTab === target);
      node.setAttribute("aria-selected", node.dataset.resultTab === target ? "true" : "false");
    });
    panels.forEach((node) => {
      node.hidden = node.dataset.resultPanel !== target;
    });
  }

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveResultTab(button.dataset.resultTab);
    });
  });

  wrongWords?.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-result-hanja-open]");
    if (!trigger) {
      return;
    }

    const wordId = trigger.getAttribute("data-result-hanja-open");
    const selectedWord = wrongVocabulary.find((word) => word.id === wordId);
    if (!selectedWord) {
      return;
    }

    openHanjaModal(hanjaModalElements, selectedWord, selectedWord.word);
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-hanja-close]")) {
      closeHanjaModal(hanjaModalElements);
      return;
    }

    const dialog = hanjaModalElements.modal?.querySelector(".learning-modal__dialog");
    if (!hanjaModalElements.modal?.hidden && dialog && !dialog.contains(event.target) && event.target.closest(".learning-modal")) {
      closeHanjaModal(hanjaModalElements);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeHanjaModal(hanjaModalElements);
    }
  });

  backLink?.addEventListener("click", (event) => {
    event.preventDefault();
    window.location.assign(backHref);
  });

  setActiveResultTab("summary");
}

async function initComplete() {
  const lesson = await getLessonMeta();
  const totalCorrect = LEARNING_STAGE_DATA.reduce((sum, item) => sum + item.correct, 0);
  const totalQuestions = LEARNING_STAGE_DATA.reduce((sum, item) => sum + item.total, 0);
  const backLink = document.querySelector("[data-complete-back-link]");
  const round = document.querySelector("[data-complete-round]");
  const score = document.querySelector("[data-complete-score]");
  const resultLink = document.querySelector("[data-complete-result-link]");
  const homeLink = document.querySelector("[data-complete-home-link]");

  if (round) {
    round.textContent = formatLessonRound(lesson);
  }

  if (score) {
    score.innerHTML = formatScoreMarkup(totalCorrect, totalQuestions);
  }

  const homeHref = hrefWithTheme(pageHref("home"));
  const resultHref = hrefWithTheme(pageHref("learning-result"));

  backLink?.setAttribute("href", homeHref);
  resultLink?.setAttribute("href", resultHref);
  homeLink?.setAttribute("href", homeHref);

  backLink?.addEventListener("click", (event) => {
    event.preventDefault();
    window.location.assign(homeHref);
  });

  resultLink?.addEventListener("click", (event) => {
    event.preventDefault();
    window.location.assign(resultHref);
  });

  homeLink?.addEventListener("click", (event) => {
    event.preventDefault();
    window.location.assign(homeHref);
  });
}

const initializers = {
  "learning-vocab-card": initVocabCard,
  "learning-vocab-matching": initVocabMatching,
  "learning-vocab-letter": initVocabLetter,
  "learning-vocab-mc": initVocabMc,
  "learning-passage-cloze": initPassageCloze,
  "learning-passage-ox": initPassageOx,
  "learning-passage-mc": initPassageMc,
  "learning-result": initResult,
  "learning-complete": initComplete,
};

async function init() {
  initTheme();
  await applyLessonMeta();
  initLearningExitModal();
  if (initializers[pageId]) {
    await initializers[pageId]();
    updateThemeAwareLinks();
  }
}

init();
