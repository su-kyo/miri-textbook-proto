import { getHanjaCharacterRows, getLessonMeta, getVocabCardDeck, getVocabMatchingPairs } from "../../shared/js/learning-adapter.js?v=20260724i";
import {
  escapeHtml,
  formatCurriculum,
  formatStrokeCount,
  hasDisplayValue,
  highlightExample,
  highlightMeaningSound,
  hrefWithTheme,
  isLongText,
  setTheme,
  TAP_ICON,
} from "../../shared/js/learning-ui-utils.js?v=20260724i";

const pageId = document.body.dataset.page;

function pageHref(page) {
  return `prototype/pages/${page}.html`;
}

function initTheme() {
  const query = new URLSearchParams(window.location.search);
  setTheme(query.get("theme") === "dark" ? "dark" : "light");

  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-theme-toggle]")) {
      return;
    }

    const nextTheme = document.body.classList.contains("theme-dark") ? "light" : "dark";
    setTheme(nextTheme);
  });
}

function createRevealButton(kind, index, text, revealed, word, label) {
  const longClass = isLongText(text) ? " word-card__reveal-item--long" : "";
  const revealedClass = revealed ? " is-revealed" : "";
  const copy = kind === "meaning" ? escapeHtml(text) : highlightExample(text, word, { tag: "strong" });

  return `
    <button class="word-card__reveal-item${longClass}${revealedClass}" type="button" data-reveal-kind="${kind}" data-reveal-index="${index}">
      <span class="word-card__reveal-copy${kind === "meaning" ? " word-card__reveal-copy--meaning" : ""}">${copy}</span>
      <span class="word-card__reveal-overlay" aria-hidden="true">
        ${TAP_ICON}
        <span>${escapeHtml(label)}</span>
      </span>
    </button>
  `;
}

function createHanjaRowMarkup(entry) {
  const meta = [
    entry.radical ? `<div class="hanja-modal__meta-row"><span>부수</span><strong>${escapeHtml(entry.radical)}</strong></div>` : "",
    hasDisplayValue(entry.totalStrokes) ? `<div class="hanja-modal__meta-row"><span>총 획수</span><strong>${escapeHtml(formatStrokeCount(entry.totalStrokes))}</strong></div>` : "",
    hasDisplayValue(entry.strokesExceptRadical)
      ? `<div class="hanja-modal__meta-row"><span>부수 외 획수</span><strong>${escapeHtml(formatStrokeCount(entry.strokesExceptRadical))}</strong></div>`
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
}

async function initVocabCardPrototype() {
  const lesson = await getLessonMeta();
  const deck = await getVocabCardDeck();
  if (!deck.length) {
    return;
  }

  const elements = {
    curriculumLabel: document.querySelector("[data-curriculum-label]"),
    viewport: document.querySelector("[data-card-viewport]"),
    track: document.querySelector("[data-card-track]"),
    paginationCurrent: document.querySelector("[data-pagination-current]"),
    paginationTotal: document.querySelector("[data-pagination-total]"),
    footerCta: document.querySelector("[data-footer-cta]"),
    modal: document.querySelector("[data-hanja-modal]"),
    modalWord: document.querySelector("[data-modal-word]"),
    modalList: document.querySelector("[data-hanja-list]"),
  };

  const state = {
    activeIndex: 0,
    pointerId: null,
    pointerStartX: null,
    pointerStartY: null,
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

  elements.curriculumLabel.textContent = formatCurriculum(lesson);
  elements.paginationTotal.textContent = String(deck.length);

  function cardState(index) {
    return state.cardStates[index];
  }

  function cardComplete(index) {
    const current = cardState(index);
    const card = deck[index];
    return current.meaningRevealed && card.examples.every((_, exampleIndex) => current.revealedExamples.has(exampleIndex));
  }

  function currentReady() {
    return cardComplete(state.activeIndex);
  }

  function allCardsReady() {
    return deck.every((_, index) => cardComplete(index));
  }

  function canMoveNext() {
    return state.activeIndex < deck.length - 1 && currentReady();
  }

  function canMovePrev() {
    return state.activeIndex > 0;
  }

  function openModal(index) {
    const card = deck[index];
    const rows = getHanjaCharacterRows(card);
    if (!rows.length) {
      return;
    }

    elements.modalWord.textContent = card.word;
    elements.modalList.innerHTML = rows.map((entry) => createHanjaRowMarkup(entry)).join("");
    elements.modal.hidden = false;
  }

  function closeModal() {
    elements.modal.hidden = true;
  }

  function updateFooterState() {
    const ready = allCardsReady();
    elements.footerCta.classList.toggle("is-ready", ready);
    elements.footerCta.setAttribute("aria-disabled", ready ? "false" : "true");
  }

  function positionTrack() {
    const firstCard = elements.track.querySelector(".word-card-proto-card");
    if (!firstCard) {
      return;
    }

    const gap = parseFloat(getComputedStyle(elements.track).gap || "24");
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
    const cardProgress = cardState(index);
    if (cardProgress.face === "front") {
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

    const hanjaRows = getHanjaCharacterRows(card);
    const showInfoButton = hanjaRows.length > 0;

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
                  <div>${createRevealButton("meaning", 0, card.meaning, cardProgress.meaningRevealed, card.word, "탭해서 뜻 보기")}</div>
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
                          cardProgress.revealedExamples.has(exampleIndex),
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

  function render() {
    elements.track.innerHTML = deck.map((card, index) => buildCardMarkup(card, index)).join("");
    elements.paginationCurrent.textContent = String(state.activeIndex + 1);
    updateFooterState();
    restoreVisibleCardScroll();
    positionTrack();
  }

  function move(direction) {
    rememberCardScroll(state.activeIndex);

    if (direction === "prev") {
      if (!canMovePrev()) {
        return;
      }
      state.activeIndex -= 1;
    } else {
      if (!canMoveNext()) {
        return;
      }
      state.activeIndex += 1;
    }

    state.dragOffset = 0;
    closeModal();
    render();
  }

  function flipCardToFront(index, cardElement) {
    if (cardState(index).face === "front") {
      return;
    }

    cardState(index).face = "front";

    const activeCard = cardElement || elements.track.querySelector(`[data-card-index="${index}"]`);
    if (!activeCard) {
      render();
      return;
    }

    requestAnimationFrame(() => {
      // Force a layout read so the first flip animates consistently on mobile browsers.
      void activeCard.offsetWidth;
      activeCard.classList.add("is-front-visible");
    });
  }

  function reveal(kind, revealIndex) {
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
    render();
  }

  function handleCardTap(target, cardElement) {
    if (cardState(state.activeIndex).face === "front") {
      return;
    }

    if (target.closest("[data-hanja-open]") || target.closest("[data-reveal-kind]")) {
      return;
    }

    flipCardToFront(state.activeIndex, cardElement);
  }

  document.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-hanja-close]");
    if (closeButton) {
      closeModal();
      return;
    }

    if (!elements.modal.hidden && event.target.closest(".learning-modal__dialog") == null && event.target.closest("[data-hanja-close]") == null) {
      if (event.target.closest(".learning-modal")) {
        closeModal();
        return;
      }
    }

    const infoButton = event.target.closest("[data-hanja-open]");
    if (infoButton) {
      openModal(Number(infoButton.dataset.hanjaOpen));
      return;
    }

    const revealButton = event.target.closest("[data-reveal-kind]");
    if (revealButton) {
      reveal(revealButton.dataset.revealKind, Number(revealButton.dataset.revealIndex || 0));
      return;
    }

    const card = event.target.closest("[data-card-index]");
    if (card && Date.now() >= state.ignoreClickUntil) {
      const index = Number(card.dataset.cardIndex);

      if (index === state.activeIndex) {
        handleCardTap(event.target, card);
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
      if (!allCardsReady()) {
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

    state.pointerId = event.pointerId;
    state.pointerStartX = event.clientX;
    state.pointerStartY = event.clientY;
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
        resetPointerState();
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
      state.dragOffset = Math.max(-72, Math.min(72, deltaX));
    }
    positionTrack();
  });

  function resetPointerState() {
    state.pointerId = null;
    state.pointerStartX = null;
    state.pointerStartY = null;
    state.pointerMode = "idle";
    state.allowSwipe = false;
    state.dragOffset = 0;
    elements.track.classList.remove("is-dragging");
    positionTrack();
  }

  elements.viewport.addEventListener("pointerup", (event) => {
    if (state.pointerId !== event.pointerId || state.pointerStartX === null) {
      return;
    }

    const wasSwiping = state.pointerMode === "swipe";
    const delta = event.clientX - state.pointerStartX;
    resetPointerState();

    if (!wasSwiping) {
      return;
    }

    if (delta <= -34) {
      state.ignoreClickUntil = Date.now() + 240;
      move("next");
      return;
    }

    if (delta >= 34) {
      state.ignoreClickUntil = Date.now() + 240;
      move("prev");
    }
  });

  elements.viewport.addEventListener("pointercancel", () => {
    resetPointerState();
  });

  window.addEventListener("resize", () => {
    positionTrack();
  });

  render();

  requestAnimationFrame(() => {
    const initialCard = getCardElement(state.activeIndex);
    if (!initialCard) {
      return;
    }
    flipCardToFront(state.activeIndex, initialCard);
  });
}

async function initVocabMatchingPrototype() {
  const lesson = await getLessonMeta();
  const pairs = await getVocabMatchingPairs();
  if (!pairs.length) {
    return;
  }

  const elements = {
    curriculumLabel: document.querySelector("[data-curriculum-label]"),
    board: document.querySelector("[data-matching-board]"),
    wordsRoot: document.querySelector("[data-matching-words]"),
    meaningsRoot: document.querySelector("[data-matching-meanings]"),
    svg: document.querySelector("[data-matching-lines]"),
    footerCta: document.querySelector("[data-footer-cta]"),
  };

  if (!elements.curriculumLabel || !elements.board || !elements.wordsRoot || !elements.meaningsRoot || !elements.svg || !elements.footerCta) {
    return;
  }

  elements.curriculumLabel.textContent = formatCurriculum(lesson);

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
    ignoreClickUntil: 0,
    drag: {
      pointerId: null,
      startSide: null,
      startId: null,
      startX: 0,
      startY: 0,
      currentX: null,
      currentY: null,
      hoverId: null,
      active: false,
    },
  };
  let errorTimer = null;
  let resizeRaf = 0;

  elements.wordsRoot.innerHTML = pairs
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

  elements.meaningsRoot.innerHTML = orderedMeanings
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

  function isComplete() {
    return state.matchedIds.size === pairs.length;
  }

  function updateFooterState() {
    const ready = isComplete();
    elements.footerCta.classList.toggle("is-ready", ready);
    elements.footerCta.setAttribute("aria-disabled", ready ? "false" : "true");
  }

  function clearSelection() {
    state.selectedWordId = null;
    state.selectedMeaningId = null;
  }

  function resetDrag() {
    state.drag.pointerId = null;
    state.drag.startSide = null;
    state.drag.startId = null;
    state.drag.startX = 0;
    state.drag.startY = 0;
    state.drag.currentX = null;
    state.drag.currentY = null;
    state.drag.hoverId = null;
    state.drag.active = false;
  }

  function getOppositeSide(side) {
    return side === "word" ? "meaning" : "word";
  }

  function getButtonBySide(side, id) {
    if (!id) {
      return null;
    }

    if (side === "word") {
      return elements.wordsRoot.querySelector(`[data-word-id="${id}"]`);
    }

    return elements.meaningsRoot.querySelector(`[data-meaning-id="${id}"]`);
  }

  function getDotBySide(side, id) {
    const button = getButtonBySide(side, id);
    return button?.querySelector(side === "word" ? ".matching-pill__dot" : ".matching-meaning__dot") ?? null;
  }

  function getDotCenter(dot, boardRect) {
    const rect = dot.getBoundingClientRect();
    return {
      x: rect.left - boardRect.left + rect.width / 2,
      y: rect.top - boardRect.top + rect.height / 2,
    };
  }

  function buildCurvePath(x1, y1, x2, y2) {
    const midX = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
  }

  function activateDrag() {
    if (state.drag.active || !state.drag.startId || !state.drag.startSide) {
      return;
    }

    state.drag.active = true;
    clearSelection();
    if (state.drag.startSide === "word") {
      state.selectedWordId = state.drag.startId;
    } else {
      state.selectedMeaningId = state.drag.startId;
    }
  }

  function updateDragHover(side, id) {
    if (!state.drag.active || !state.drag.startSide) {
      return;
    }

    if (side !== getOppositeSide(state.drag.startSide) || state.matchedIds.has(id)) {
      return;
    }

    if (state.drag.hoverId === id) {
      return;
    }

    state.drag.hoverId = id;
    render();
  }

  function clearDragHover(side, id) {
    if (!state.drag.active || !state.drag.startSide) {
      return;
    }

    if (side !== getOppositeSide(state.drag.startSide) || state.drag.hoverId !== id) {
      return;
    }

    state.drag.hoverId = null;
    render();
  }

  function resolveDragHoverFromPoint(clientX, clientY) {
    if (!state.drag.active || !state.drag.startSide) {
      return;
    }

    const oppositeSide = getOppositeSide(state.drag.startSide);
    const target = document.elementFromPoint(clientX, clientY);
    const button =
      oppositeSide === "word"
        ? target?.closest("[data-word-id]")
        : target?.closest("[data-meaning-id]");
    const nextId =
      oppositeSide === "word"
        ? button?.dataset.wordId ?? null
        : button?.dataset.meaningId ?? null;

    state.drag.hoverId = nextId && !state.matchedIds.has(nextId) ? nextId : null;
  }

  function drawPreviewLine(boardRect) {
    if (!state.drag.active || !state.drag.startSide || !state.drag.startId) {
      return "";
    }

    const startDot = getDotBySide(state.drag.startSide, state.drag.startId);
    if (!startDot) {
      return "";
    }

    const start = getDotCenter(startDot, boardRect);
    const hoverDot = state.drag.hoverId
      ? getDotBySide(getOppositeSide(state.drag.startSide), state.drag.hoverId)
      : null;
    const end = hoverDot
      ? getDotCenter(hoverDot, boardRect)
      : state.drag.currentX === null || state.drag.currentY === null
        ? null
        : {
            x: state.drag.currentX - boardRect.left,
            y: state.drag.currentY - boardRect.top,
          };

    if (!end) {
      return "";
    }

    const lineColor = pairColorById.get(state.drag.startId) ?? "var(--learning-brand-secondary)";
    return `<path class="matching-board__line matching-board__line--preview" style="--matching-line-color: ${lineColor};" d="${buildCurvePath(start.x, start.y, end.x, end.y)}" />`;
  }

  function drawLines() {
    const boardRect = elements.board.getBoundingClientRect();
    const width = Math.max(1, Math.round(boardRect.width));
    const height = Math.max(1, Math.round(boardRect.height));
    elements.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const lines = Array.from(state.matchedIds)
      .map((id) => {
        const wordDot = elements.wordsRoot.querySelector(`[data-word-id="${id}"] .matching-pill__dot`);
        const meaningDot = elements.meaningsRoot.querySelector(`[data-meaning-id="${id}"] .matching-meaning__dot`);
        if (!wordDot || !meaningDot) {
          return "";
        }

        const wordRect = wordDot.getBoundingClientRect();
        const meaningRect = meaningDot.getBoundingClientRect();
        const x1 = wordRect.left - boardRect.left + wordRect.width / 2;
        const y1 = wordRect.top - boardRect.top + wordRect.height / 2;
        const x2 = meaningRect.left - boardRect.left + meaningRect.width / 2;
        const y2 = meaningRect.top - boardRect.top + meaningRect.height / 2;
        const lineColor = pairColorById.get(id) ?? "var(--learning-status-success)";

        return `<path class="matching-board__line" data-line-id="${id}" style="--matching-line-color: ${lineColor};" d="${buildCurvePath(x1, y1, x2, y2)}" />`;
      })
      .filter(Boolean);

    const previewLine = drawPreviewLine(boardRect);
    if (previewLine) {
      lines.push(previewLine);
    }

    elements.svg.innerHTML = lines.join("");
    elements.svg.querySelectorAll(".matching-board__line").forEach((path) => {
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
    elements.wordsRoot.querySelectorAll("[data-word-id]").forEach((node) => {
      const id = node.dataset.wordId;
      node.classList.toggle("is-active", id === state.selectedWordId);
      node.classList.toggle("is-matched", state.matchedIds.has(id));
      node.classList.toggle(
        "is-outfocused",
        !!state.selectedWordId && id !== state.selectedWordId && !state.matchedIds.has(id),
      );
    });

    elements.meaningsRoot.querySelectorAll("[data-meaning-id]").forEach((node) => {
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
    const word = elements.wordsRoot.querySelector(`[data-word-id="${wordId}"]`);
    const meaning = elements.meaningsRoot.querySelector(`[data-meaning-id="${meaningId}"]`);
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

  function beginDragCandidate(side, id, event) {
    if (state.matchedIds.has(id)) {
      return;
    }

    state.drag.pointerId = event.pointerId;
    state.drag.startSide = side;
    state.drag.startId = id;
    state.drag.startX = event.clientX;
    state.drag.startY = event.clientY;
    state.drag.currentX = event.clientX;
    state.drag.currentY = event.clientY;
    state.drag.hoverId = null;
    state.drag.active = false;
  }

  function updateDrag(event) {
    if (state.drag.pointerId !== event.pointerId) {
      return;
    }

    state.drag.currentX = event.clientX;
    state.drag.currentY = event.clientY;

    if (!state.drag.active) {
      const distance = Math.hypot(event.clientX - state.drag.startX, event.clientY - state.drag.startY);
      if (distance > 8) {
        activateDrag();
      }
    }

    if (!state.drag.active) {
      return;
    }

    resolveDragHoverFromPoint(event.clientX, event.clientY);
    render();
  }

  function finishDrag(event) {
    if (state.drag.pointerId !== event.pointerId) {
      return;
    }

    const wasActive = state.drag.active;
    const startSide = state.drag.startSide;
    const startId = state.drag.startId;

    if (wasActive) {
      resolveDragHoverFromPoint(event.clientX, event.clientY);
    }

    const hoverId = state.drag.hoverId;
    resetDrag();

    if (!wasActive) {
      return;
    }

    state.ignoreClickUntil = performance.now() + 240;

    if (!hoverId || !startSide || !startId) {
      clearSelection();
      render();
      return;
    }

    if (startSide === "word") {
      tryMatch(startId, hoverId);
      return;
    }

    tryMatch(hoverId, startId);
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

  elements.wordsRoot.querySelectorAll("[data-word-id]").forEach((node) => {
    const wordId = node.dataset.wordId;
    node.addEventListener("pointerdown", (event) => {
      beginDragCandidate("word", wordId, event);
    });
    node.addEventListener("pointerenter", () => {
      updateDragHover("word", wordId);
    });
    node.addEventListener("pointerleave", () => {
      clearDragHover("word", wordId);
    });
  });

  elements.meaningsRoot.querySelectorAll("[data-meaning-id]").forEach((node) => {
    const meaningId = node.dataset.meaningId;
    node.addEventListener("pointerdown", (event) => {
      beginDragCandidate("meaning", meaningId, event);
    });
    node.addEventListener("pointerenter", () => {
      updateDragHover("meaning", meaningId);
    });
    node.addEventListener("pointerleave", () => {
      clearDragHover("meaning", meaningId);
    });
  });

  document.addEventListener("click", (event) => {
    if (performance.now() < state.ignoreClickUntil) {
      return;
    }

    const wordButton = event.target.closest("[data-word-id]");
    if (wordButton && elements.wordsRoot.contains(wordButton)) {
      handleWordSelect(wordButton.dataset.wordId);
      return;
    }

    const meaningButton = event.target.closest("[data-meaning-id]");
    if (meaningButton && elements.meaningsRoot.contains(meaningButton)) {
      handleMeaningSelect(meaningButton.dataset.meaningId);
      return;
    }

    if (event.target.closest("[data-footer-cta]")) {
      if (elements.footerCta.getAttribute("aria-disabled") === "true") {
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
  resizeObserver.observe(elements.board);

  window.addEventListener("pointermove", updateDrag);
  window.addEventListener("pointerup", finishDrag);
  window.addEventListener("pointercancel", finishDrag);

  render();
}

async function init() {
  initTheme();
  if (pageId === "learning-vocab-card") {
    await initVocabCardPrototype();
    return;
  }

  if (pageId === "learning-vocab-matching") {
    await initVocabMatchingPrototype();
  }
}

init();
