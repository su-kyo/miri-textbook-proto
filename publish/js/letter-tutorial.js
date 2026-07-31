// 글자 맞추기 진입 시 1회 노출되는 조작법 안내 오버레이.
// 문제 데이터를 절대 참조하지 않는다. 무대는 전부 하드코딩된 스켈레톤 도형이다.

const TUTORIAL_HIDDEN_KEY_PREFIX = "miri-textbook-letter-tutorial-hidden-";
const SUFFIX_BY_VARIANT = { grade12: "12", grade34: "34", grade56: "56" };
const CAPTIONS = {
  12: "글자 타일을 끌어서 순서를 바꿔 단어를 완성해요.",
  34: "알맞은 타일을 빈칸에 끌어다 놓아요.",
  56: "알맞은 타일을 빈칸에 끌어다 놓아요.",
};
const CHECK_ICON = `
  <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <path d="M2 6.2 4.6 8.8 10 3.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
`;

function readHiddenFlag(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function writeHiddenFlag(key) {
  try {
    localStorage.setItem(key, "1");
  } catch (error) {
    void error;
  }
}

function clearHiddenFlags() {
  Object.values(SUFFIX_BY_VARIANT).forEach((suffix) => {
    try {
      localStorage.removeItem(`${TUTORIAL_HIDDEN_KEY_PREFIX}${suffix}`);
    } catch (error) {
      void error;
    }
  });
}

// 1~2학년: 타일 행 안에서 순서를 바꾸는 무대.
function buildSwapStage() {
  return `
    <div class="letter-tutorial__scene letter-tutorial__scene--swap">
      <div class="tut-meaning-box">
        <span class="tut-bar"></span>
        <span class="tut-bar"></span>
      </div>
      <div class="tut-tile tut-tile--b"><span class="tut-mark tut-mark--b"></span></div>
      <div class="tut-tile tut-tile--a"><span class="tut-mark tut-mark--a"></span></div>
      <div class="tut-tile tut-tile--c"><span class="tut-mark tut-mark--c"></span></div>
      <div class="tut-pointer"><span class="tut-ring"></span></div>
      <div class="tut-check">${CHECK_ICON}</div>
    </div>
  `;
}

// 3~6학년: 타일을 빈칸으로 끌어다 놓는 무대. 배치만 다르고 안무는 동일하다.
function buildFillStage(suffix) {
  const isSentence = suffix === "56";
  const context = isSentence
    ? `
      <span class="tut-bar tut-sentence"></span>
      <span class="tut-bar tut-sentence-piece tut-sentence-piece--pre"></span>
      <span class="tut-bar tut-sentence-piece tut-sentence-piece--post"></span>
    `
    : `<span class="tut-bar tut-meaning-bar"></span>`;

  return `
    <div class="letter-tutorial__scene letter-tutorial__scene--fill letter-tutorial__scene--g${suffix}">
      ${context}
      <div class="tut-blank tut-blank--1"><span class="tut-fill"><span class="tut-mark tut-mark--a"></span></span></div>
      <div class="tut-blank tut-blank--2"><span class="tut-fill"><span class="tut-mark tut-mark--b"></span></span></div>
      <div class="tut-blank tut-blank--3"><span class="tut-fill"><span class="tut-mark tut-mark--c"></span></span></div>
      <div class="tut-tile tut-tile--a"><span class="tut-mark tut-mark--a"></span></div>
      <div class="tut-tile tut-tile--d"><span class="tut-mark tut-mark--d"></span></div>
      <div class="tut-tile tut-tile--b"><span class="tut-mark tut-mark--b"></span></div>
      <div class="tut-tile tut-tile--e"><span class="tut-mark tut-mark--e"></span></div>
      <div class="tut-tile tut-tile--c"><span class="tut-mark tut-mark--c"></span></div>
      <div class="tut-pointer"><span class="tut-ring"></span></div>
      <div class="tut-check">${CHECK_ICON}</div>
    </div>
  `;
}

function buildTutorialMarkup(suffix) {
  const stage = suffix === "12" ? buildSwapStage() : buildFillStage(suffix);

  return `
    <section class="letter-tutorial" data-letter-tutorial>
      <div class="letter-tutorial__card" role="dialog" aria-modal="true" aria-labelledby="letter-tutorial-title">
        <h2 class="letter-tutorial__title" id="letter-tutorial-title">이렇게 풀어요!</h2>
        <div class="letter-tutorial__stage letter-tutorial__stage--grade${suffix}">${stage}</div>
        <p class="letter-tutorial__caption">${CAPTIONS[suffix]}</p>
        <label class="letter-tutorial__check">
          <input type="checkbox" data-letter-tutorial-check />
          <span>다시 보지 않기</span>
        </label>
        <button class="letter-tutorial__cta" type="button" data-letter-tutorial-start>시작하기</button>
      </div>
    </section>
  `;
}

export function initLetterTutorial({ variant, query } = {}) {
  const suffix = SUFFIX_BY_VARIANT[variant];
  if (!suffix) {
    return;
  }

  const params = query ?? new URLSearchParams(window.location.search);
  if (params.get("reset") === "tutorial") {
    clearHiddenFlags();
  }

  const hiddenKey = `${TUTORIAL_HIDDEN_KEY_PREFIX}${suffix}`;
  const forced = params.get("tutorial") === "1";
  if (!forced && readHiddenFlag(hiddenKey)) {
    return;
  }

  const shell = document.querySelector(".learning-shell");
  if (!shell || shell.querySelector("[data-letter-tutorial]")) {
    return;
  }

  shell.insertAdjacentHTML("beforeend", buildTutorialMarkup(suffix));

  const overlay = shell.querySelector("[data-letter-tutorial]");
  const checkbox = overlay.querySelector("[data-letter-tutorial-check]");

  // 닫기는 "시작하기"로만 가능하다. dim 탭·ESC는 무시한다.
  overlay.addEventListener("click", (event) => {
    if (!event.target.closest("[data-letter-tutorial-start]")) {
      return;
    }

    if (checkbox?.checked) {
      writeHiddenFlag(hiddenKey);
    }

    overlay.remove();
  });
}
