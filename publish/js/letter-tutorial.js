// 글자 맞추기 진입 시 1회 노출되는 조작법 안내 오버레이.
// 무대는 스켈레톤 영상(asset/video/tutorial/*.mp4)을 재생한다. 문제 데이터를 절대 참조하지 않는다.
// 영상 원본과 재생성 방법: tools/tutorial-capture/

const TUTORIAL_HIDDEN_KEY_PREFIX = "miri-textbook-letter-tutorial-hidden-";
// 3~4/5~6학년은 같은 튜토리얼을 쓰므로 영상과 "다시 보지 않기" 저장 키를 "fill" 하나로 통합한다.
const STAGE_BY_VARIANT = { grade12: "swap", grade34: "fill", grade56: "fill" };
const KEY_SUFFIX_BY_STAGE = { swap: "12", fill: "fill" };
const LEGACY_KEY_SUFFIXES = ["34", "56"];
const CAPTIONS = {
  swap: "글자 타일을 끌어서 순서를 바꿔 단어를 완성해요.",
  fill: "알맞은 타일을 빈칸에 끌어다 놓아요.",
};
const VIDEO_VERSION = "20260731e";

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
  [...Object.values(KEY_SUFFIX_BY_STAGE), ...LEGACY_KEY_SUFFIXES].forEach((suffix) => {
    try {
      localStorage.removeItem(`${TUTORIAL_HIDDEN_KEY_PREFIX}${suffix}`);
    } catch (error) {
      void error;
    }
  });
}

function currentTheme() {
  return document.body.classList.contains("theme-dark") ? "dark" : "light";
}

function videoSrc(stage) {
  return `asset/video/tutorial/letter-${stage}-${currentTheme()}.mp4?v=${VIDEO_VERSION}`;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function buildTutorialMarkup(stage, manual) {
  return `
    <section class="letter-tutorial" data-letter-tutorial>
      <div class="letter-tutorial__card" role="dialog" aria-modal="true" aria-labelledby="letter-tutorial-title">
        <h2 class="letter-tutorial__title" id="letter-tutorial-title">이렇게 풀어요!</h2>
        <div class="letter-tutorial__stage">
          <video class="letter-tutorial__video" muted loop playsinline preload="auto" src="${videoSrc(stage)}"></video>
        </div>
        <p class="letter-tutorial__caption">${CAPTIONS[stage]}</p>
        ${manual
          ? ""
          : `
        <label class="letter-tutorial__check">
          <input type="checkbox" data-letter-tutorial-check />
          <span>다시 보지 않기</span>
        </label>`}
        <button class="letter-tutorial__cta" type="button" data-letter-tutorial-start>${manual ? "닫기" : "시작하기"}</button>
      </div>
    </section>
  `;
}

// 모션 최소화 환경에서는 자동재생 대신 성공 장면(체크 표시가 뜬 뒤)에 멈춰 둔다.
function applyMotionPreference(video) {
  if (prefersReducedMotion()) {
    video.addEventListener(
      "loadedmetadata",
      () => {
        video.currentTime = video.duration * 0.7;
      },
      { once: true },
    );
    return;
  }

  video.autoplay = true;
  video.play?.()?.catch?.(() => {});
}

export function initLetterTutorial({ variant, query, manual = false } = {}) {
  const stage = STAGE_BY_VARIANT[variant];
  if (!stage) {
    return;
  }

  const params = query ?? new URLSearchParams(window.location.search);
  if (!manual && params.get("reset") === "tutorial") {
    clearHiddenFlags();
  }

  const hiddenKey = `${TUTORIAL_HIDDEN_KEY_PREFIX}${KEY_SUFFIX_BY_STAGE[stage]}`;
  const forced = manual || params.get("tutorial") === "1";
  if (!forced && readHiddenFlag(hiddenKey)) {
    return;
  }

  const shell = document.querySelector(".learning-shell");
  if (!shell || shell.querySelector("[data-letter-tutorial]")) {
    return;
  }

  shell.insertAdjacentHTML("beforeend", buildTutorialMarkup(stage, manual));

  const overlay = shell.querySelector("[data-letter-tutorial]");
  const checkbox = overlay.querySelector("[data-letter-tutorial-check]");
  const video = overlay.querySelector(".letter-tutorial__video");

  applyMotionPreference(video);

  // 오버레이가 떠 있는 동안 테마가 바뀌면 같은 재생 위치를 유지한 채 영상만 교체한다.
  const themeObserver = new MutationObserver(() => {
    const nextSrc = videoSrc(stage);
    if (video.getAttribute("src") === nextSrc) {
      return;
    }

    const resumeAt = video.currentTime;
    video.setAttribute("src", nextSrc);
    video.addEventListener(
      "loadedmetadata",
      () => {
        video.currentTime = resumeAt;
        if (!prefersReducedMotion()) {
          video.play?.()?.catch?.(() => {});
        }
      },
      { once: true },
    );
  });
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });

  // 닫기는 CTA 버튼으로만 가능하다. dim 탭·ESC는 무시한다.
  overlay.addEventListener("click", (event) => {
    if (!event.target.closest("[data-letter-tutorial-start]")) {
      return;
    }

    if (checkbox?.checked) {
      writeHiddenFlag(hiddenKey);
    }

    themeObserver.disconnect();
    overlay.remove();
  });
}
