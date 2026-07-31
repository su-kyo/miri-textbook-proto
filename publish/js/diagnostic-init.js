import { escapeHtml, hrefWithTheme, setTheme } from "../../shared/js/learning-ui-utils.js?v=20260731b";
import { loadDiagnosticContentRaw } from "../../shared/js/data-loader.js?v=20260731b";

const pageId = document.body.dataset.page;
const initialQuery = new URLSearchParams(window.location.search);
const pageMode = document.body.dataset.mode === "prototype" || initialQuery.get("mode") === "prototype" ? "prototype" : "publish";
const DIAGNOSTIC_STORAGE_KEY = "miri-textbook-diagnostic";
const DIAGNOSTIC_GRADE_KEY = "miri-textbook-diagnostic-grade";
const BOTTOM_SHEET_TRANSITION_MS = 320;

function readDiagnosticGrade() {
  try {
    return localStorage.getItem(DIAGNOSTIC_GRADE_KEY) || "1";
  } catch (error) {
    return "1";
  }
}

function pageHref(page) {
  return pageMode === "prototype" ? `/prototype/pages/${page}.html` : `/publish/${page}.html`;
}

function initTheme() {
  setTheme(initialQuery.get("theme") === "dark" ? "dark" : "light");

  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-theme-toggle]")) {
      return;
    }

    const nextTheme = document.body.classList.contains("theme-dark") ? "light" : "dark";
    setTheme(nextTheme);
  });
}

function renderStem(question) {
  const stem = question.stem ?? "";
  if (question.blank) {
    return stem
      .split("{blank}")
      .map((part) => escapeHtml(part))
      .join(`<span class="diagnostic-blank" role="img" aria-label="빈칸"></span>`);
  }

  return escapeHtml(stem);
}

function passageMarkup(passage) {
  if (!passage) {
    return "";
  }

  const lines = passage.paragraphs ?? [];
  const placeholderAfter = passage.imagePlaceholder && Number.isInteger(passage.imagePlaceholderAfter) ? passage.imagePlaceholderAfter : -1;
  const parts = [];
  lines.forEach((line, index) => {
    parts.push(`<p class="diagnostic-passage__line">${escapeHtml(line)}</p>`);
    if (index === placeholderAfter) {
      parts.push(`<div class="diagnostic-passage__image" role="img" aria-label="이미지 자리">이미지 들어올 자리</div>`);
    }
  });
  return `
    ${passage.title ? `<h2 class="diagnostic-passage__title">${escapeHtml(passage.title)}</h2>` : ""}
    ${parts.join("")}
  `;
}

function readDiagnosticRecord() {
  try {
    const raw = localStorage.getItem(DIAGNOSTIC_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function saveDiagnosticRecord(record) {
  try {
    localStorage.setItem(DIAGNOSTIC_STORAGE_KEY, JSON.stringify(record));
  } catch (error) {
    void error;
  }
}

function buildExitModal() {
  return `
    <section class="learning-exit-modal" hidden data-diagnostic-exit-modal>
      <div class="learning-exit-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="diagnostic-exit-title" aria-describedby="diagnostic-exit-copy">
        <h2 class="learning-exit-modal__title" id="diagnostic-exit-title">진단평가를 나가시겠어요?</h2>
        <p class="learning-exit-modal__copy" id="diagnostic-exit-copy">지금 나가면 지금까지 고른 답은 저장되지 않고, 다시 시작할 때는 처음부터 진행하게 됩니다.</p>
        <div class="learning-exit-modal__actions">
          <button class="learning-exit-modal__button learning-exit-modal__button--cancel" type="button" data-diagnostic-exit-cancel>아니오</button>
          <button class="learning-exit-modal__button learning-exit-modal__button--confirm" type="button" data-diagnostic-exit-confirm>예</button>
        </div>
      </div>
    </section>
  `;
}

function initExit() {
  const backLink = document.querySelector(".learning-header__left .learning-icon-button");
  if (!backLink) {
    return;
  }

  backLink.dataset.diagnosticExitTrigger = "true";
  document.body.insertAdjacentHTML("beforeend", buildExitModal());

  const modal = document.querySelector("[data-diagnostic-exit-modal]");
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
    if (event.target.closest("[data-diagnostic-exit-trigger]")) {
      event.preventDefault();
      openModal();
      return;
    }

    if (event.target.closest("[data-diagnostic-exit-cancel]")) {
      event.preventDefault();
      closeModal();
      return;
    }

    if (event.target.closest("[data-diagnostic-exit-confirm]")) {
      event.preventDefault();
      window.location.replace(hrefWithTheme(pageHref("home")));
      return;
    }

    if (!modal?.hidden && dialog && !dialog.contains(event.target) && event.target.closest("[data-diagnostic-exit-modal]")) {
      closeModal();
    }
  });
}

async function initQuiz() {
  const data = await loadDiagnosticContentRaw(readDiagnosticGrade());
  const questions = Array.isArray(data.questions) ? data.questions : [];
  const passages = Array.isArray(data.passages) ? data.passages : [];
  const passageById = new Map(passages.map((passage) => [passage.id, passage]));

  if (!questions.length) {
    return;
  }

  const flow = Array.isArray(data.assessment?.flow) && data.assessment.flow.length
    ? data.assessment.flow
    : ["vocab", "passage-1", "reading-1", "passage-2", "reading-2"];

  const steps = [];
  flow.forEach((token) => {
    if (token.startsWith("passage-")) {
      const passage = passageById.get(token);
      if (passage) {
        steps.push({ type: "passage", passage });
      }
      return;
    }

    questions.filter((question) => question.section === token).forEach((question) => steps.push({ type: "question", question }));
  });

  const totalQuestions = questions.length;
  let questionCounter = 0;
  steps.forEach((step) => {
    if (step.type === "question") {
      questionCounter += 1;
      step.questionNumber = questionCounter;
    }
  });

  const state = { stepIndex: 0, answers: {} };

  const root = document.querySelector("[data-diagnostic-root]");
  const cta = document.querySelector("[data-diagnostic-cta]");
  const prev = document.querySelector("[data-diagnostic-prev]");
  const content = document.querySelector(".learning-content");
  const sheet = document.querySelector("[data-diagnostic-passage-sheet]");
  const sheetBody = document.querySelector("[data-diagnostic-passage-sheet-body]");

  function setCtaEnabled(enabled) {
    cta.setAttribute("aria-disabled", enabled ? "false" : "true");
  }

  // 닫는 도중 다시 열릴 수 있으므로 예약된 hidden 처리를 취소하고 연다.
  let sheetCloseTimer = null;

  function openSheet() {
    window.clearTimeout(sheetCloseTimer);
    sheetCloseTimer = null;
    sheet.hidden = false;
    // 강제 리플로우로 열기 전 상태를 커밋해야 슬라이드 전환이 재생된다.
    void sheet.offsetHeight;
    sheet.classList.add("is-open");
  }

  function closeSheet() {
    window.clearTimeout(sheetCloseTimer);
    sheet.classList.remove("is-open");
    sheetCloseTimer = window.setTimeout(() => {
      sheetCloseTimer = null;
      if (!sheet.classList.contains("is-open")) {
        sheet.hidden = true;
      }
    }, BOTTOM_SHEET_TRANSITION_MS);
  }

  function render() {
    const step = steps[state.stepIndex];
    const isLast = state.stepIndex === steps.length - 1;

    root.classList.toggle("learning-content__inner--quiz-passage", step.type === "passage");

    if (prev) {
      prev.hidden = state.stepIndex === 0;
    }

    if (step.type === "passage") {
      root.innerHTML = `
        <article class="learning-card passage-card diagnostic-passage-card">
          <div class="passage-card__body diagnostic-passage">${passageMarkup(step.passage)}</div>
        </article>
      `;
      cta.textContent = "다음";
      setCtaEnabled(true);
    } else {
      const question = step.question;
      const selected = state.answers[question.id];
      const isReading = question.section !== "vocab";
      const stemMarkup = question.boxed
        ? `<article class="learning-card question-prompt-card diagnostic-stem-card"><p class="question-prompt-card__title">${renderStem(question)}</p></article>`
        : `<p class="diagnostic-stem">${renderStem(question)}</p>`;
      root.innerHTML = `
        <section class="question-block question-block--vocab-mc">
          <p class="diagnostic-progress"><span class="diagnostic-progress__current">${step.questionNumber}</span>/${totalQuestions}</p>
          ${question.instruction ? `<p class="diagnostic-instruction">${escapeHtml(question.instruction)}</p>` : ""}
          ${stemMarkup}
          ${isReading ? `<button class="diagnostic-passage-toggle" type="button" data-diagnostic-passage-open>지문 다시 보기</button>` : ""}
          <div class="mc-options" data-diagnostic-options>
            ${question.options
              .map(
                (option, index) =>
                  `<button class="option-card ${selected === index ? "is-selected" : ""}" type="button" data-diagnostic-option="${index}">${escapeHtml(option)}</button>`,
              )
              .join("")}
          </div>
        </section>
      `;
      cta.textContent = isLast ? "제출하기" : "다음";
      setCtaEnabled(selected !== undefined);
    }

    if (content) {
      content.scrollTop = 0;
    }
  }

  function submit() {
    saveDiagnosticRecord({
      status: "completed",
      completedAt: new Date().toISOString(),
      answers: { ...state.answers },
    });
    window.location.assign(hrefWithTheme(pageHref("diagnostic-complete")));
  }

  root.addEventListener("click", (event) => {
    const optionButton = event.target.closest("[data-diagnostic-option]");
    if (optionButton) {
      const step = steps[state.stepIndex];
      if (step.type !== "question") {
        return;
      }

      const index = Number(optionButton.dataset.diagnosticOption);
      state.answers[step.question.id] = index;
      root.querySelectorAll("[data-diagnostic-option]").forEach((button) => {
        button.classList.toggle("is-selected", Number(button.dataset.diagnosticOption) === index);
      });
      setCtaEnabled(true);
      return;
    }

    if (event.target.closest("[data-diagnostic-passage-open]")) {
      const step = steps[state.stepIndex];
      const passage = step.type === "question" ? passageById.get(step.question.passageId) : null;
      if (passage) {
        sheetBody.innerHTML = passageMarkup(passage);
        sheetBody.scrollTop = 0;
        openSheet();
      }
    }
  });

  sheet.addEventListener("click", (event) => {
    if (event.target.closest("[data-diagnostic-passage-close]") || event.target === sheet) {
      closeSheet();
    }
  });

  if (prev) {
    prev.addEventListener("click", () => {
      if (state.stepIndex === 0) {
        return;
      }

      state.stepIndex -= 1;
      render();
    });
  }

  cta.addEventListener("click", () => {
    if (cta.getAttribute("aria-disabled") === "true") {
      return;
    }

    if (state.stepIndex === steps.length - 1) {
      submit();
      return;
    }

    state.stepIndex += 1;
    render();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !sheet.hidden) {
      closeSheet();
    }
  });

  render();
}

function initComplete() {
  if (!readDiagnosticRecord()) {
    saveDiagnosticRecord({ status: "completed", completedAt: new Date().toISOString(), answers: {} });
  }

  const homeHref = hrefWithTheme(pageHref("home"));
  document.querySelectorAll("[data-diagnostic-complete-back], [data-diagnostic-complete-home]").forEach((anchor) => {
    anchor.setAttribute("href", homeHref);
    anchor.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.assign(homeHref);
    });
  });
}

function init() {
  initTheme();
  if (pageId === "diagnostic-quiz") {
    initExit();
    initQuiz();
  } else if (pageId === "diagnostic-complete") {
    initComplete();
  }
}

init();
