# Learning Style Token Rollout

## Goal

Apply the Figma token system to the learning experience first, while keeping the home screen as a separate dark-only surface for a later pass.

## Execution Order

| Step | Scope | What to do | Done when |
| --- | --- | --- | --- |
| 1 | Token foundation | Reorganize `shared/css/tokens.css` so primitive, typography, learning semantic, and home semantic layers are clearly separated. Update learning semantic values to match the Figma token directions first. | Learning token names remain stable, but values and structure reflect the Figma system. |
| 2 | Learning shell | Update `shared/css/learning-shell.css` so page background, header, footer, progress, bottom sheet, and shared spacing consume the revised learning tokens consistently. | Shared shell areas look coherent in both light and dark themes. |
| 3 | Learning components | Update `shared/css/learning-components.css` so cards, options, passage blocks, result sections, and state colors use the same semantic tokens without ad hoc color drift. | Reusable component states align with Figma light/dark intent. |
| 4 | Screen sweep | Verify the main learning pages in priority order: `learning-vocab-mc`, `learning-passage-mc`, `learning-passage-ox`, `learning-vocab-matching`, `learning-vocab-letter`, `learning-vocab-card`, `learning-passage-cloze`, `learning-result`, `learning-complete`. | Each target page renders with the new shared token system and no broken contrast or layout regressions. |
| 5 | Follow-up note | Document any home-only colors, opacity accents, or gaps that should stay outside the learning token system. | We have a short handoff note for the later home refactor. |

## Working Assumptions

- Home stays outside the learning light/dark semantic system for now.
- Existing class names and page structure stay intact unless a token mismatch forces a minimal selector change.
- User-owned constellation image changes remain untouched.

## Risks To Watch

- Some learning screens use image-backed surfaces, so token changes can reduce contrast if borders and text are not tuned together.
- `learning-vocab-card` mixes themed imagery with semantic surfaces and will likely need the most visual balancing.
- The current global tokens still support non-learning pages, so learning changes should prefer scoped `--learning-*` usage over global color rewrites.
