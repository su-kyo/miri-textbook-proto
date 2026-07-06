export function buildLearningLetterDebugMarkup(state) {
  if (!state.letterDebugOpen) {
    return "";
  }

  return `
    <section class="page-content" style="padding-top:0;">
      <div class="debug-panel">
        <div class="debug-panel__title">Learning Debug</div>
        <div class="debug-panel__actions">
          <button class="chip-button" data-letter-variant="lowerGrade">저학년 콘텐츠 보기</button>
          <button class="chip-button" data-letter-variant="upperGrade">고학년 콘텐츠 보기</button>
        </div>
      </div>
    </section>
  `;
}

export function wireLearningLetterDebug(root, store) {
  root.querySelectorAll("[data-letter-debug-open]").forEach((target) => {
    target.addEventListener("click", () => {
      store.update((state) => ({ ...state, letterDebugOpen: !state.letterDebugOpen }));
    });
  });

  root.querySelectorAll("[data-letter-variant]").forEach((button) => {
    button.addEventListener("click", () => {
      const variant = button.getAttribute("data-letter-variant");
      store.update((state) => ({
        ...state,
        letterVariant: variant,
        letterDebugOpen: false,
      }));
    });
  });
}
