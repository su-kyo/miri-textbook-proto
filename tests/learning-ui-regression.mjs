import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const css = readFileSync(new URL("../shared/css/learning-components.css", import.meta.url), "utf8");
const shellCss = readFileSync(new URL("../shared/css/learning-shell.css", import.meta.url), "utf8");
const publishJs = readFileSync(new URL("../publish/js/learning-publish-init.js", import.meta.url), "utf8");
const oxHtml = readFileSync(new URL("../publish/learning-passage-ox.html", import.meta.url), "utf8");
const passageMcHtml = readFileSync(new URL("../publish/learning-passage-mc.html", import.meta.url), "utf8");
const prototypeResultHtml = readFileSync(new URL("../prototype/pages/learning-result.html", import.meta.url), "utf8");

assert.match(css, /\.passage-blank\s*\{[\s\S]*margin:\s*0 2px;/, "passage blanks should keep a little more inline spacing");
assert.match(css, /\.passage-blank\s*\{[\s\S]*border:\s*2px solid var\(--learning-border-brand\);/, "passage blanks should use the stronger border style");
assert.match(css, /\.passage-blank\.is-active\s*\{[\s\S]*border-color:\s*var\(--learning-status-success\);/, "active passage blank should use the stronger success border");
assert.match(css, /\.letter-question-card\s*\{[\s\S]*background:\s*var\(--learning-brand-primary-soft\);/, "upper-grade letter card should match the Figma purple panel");
assert.match(css, /\.letter-answer-stage\s*\{[\s\S]*min-height:\s*168px;/, "letter answer stage should match the Figma height");
assert.match(publishJs, /grade56: "예문을 보고 어떤 단어인지 추리해보세요\.",/, "letter chapter copy should match the Figma text for the 5-6 grade band");
assert.match(publishJs, /description\.textContent = LETTER_DESCRIPTIONS\[variant\];/, "letter chapter copy should follow the resolved grade band");
assert.match(publishJs, /progress\.innerHTML = buildProgressStateMarkup\(/, "OX chapter should use state-based progress rendering");
assert.match(publishJs, /index === state\.currentIndex\) \{\s*return state\.solved \? "complete" : "active";/m, "OX current step should become complete as soon as the answer is correct");
assert.doesNotMatch(oxHtml, /learning-shell--footerless/, "OX screen should restore the footer slot for the explanation toggle");
assert.doesNotMatch(passageMcHtml, /learning-shell--footerless/, "passage MC screen should restore the footer slot for the explanation toggle");
assert.match(oxHtml, /data-explanation-toggle/, "OX screen should include an explanation toggle button in the footer");
assert.match(passageMcHtml, /data-explanation-toggle/, "passage MC screen should include an explanation toggle button in the footer");
assert.match(oxHtml, /class="learning-footer__cta is-invisible"/, "OX explanation toggle should reserve footer height from the initial render");
assert.match(passageMcHtml, /class="learning-footer__cta is-invisible"/, "passage MC explanation toggle should reserve footer height from the initial render");
assert.match(publishJs, /sheetDismissed:\s*false/, "feedback sheets should track whether the explanation was manually dismissed");
assert.match(shellCss, /\.learning-footer__cta\.is-invisible\s*\{[\s\S]*visibility:\s*hidden;[\s\S]*pointer-events:\s*none;/, "footer explanation toggle should keep its layout slot while remaining visually hidden");
assert.match(publishJs, /function setFooterGhostVisibility\(button, visible\) \{[\s\S]*button\.classList\.toggle\("is-invisible", !visible\);[\s\S]*button\.tabIndex = visible \? 0 : -1;/m, "footer explanation toggle should switch between visible and invisible states without collapsing the footer height");
assert.match(publishJs, /if \(state\.solved && !state\.sheetDismissed\) \{\s*openBottomSheet\(sheet\);\s*\} else \{\s*closeBottomSheet\(sheet\);\s*\}/m, "solved screens should reopen the sheet only when it has not been manually dismissed");
assert.match(publishJs, /event\.target\.closest\("\[data-explanation-toggle\]"\)/, "footer explanation toggle should reopen the feedback sheet");
assert.match(publishJs, /document\.addEventListener\("pointerdown", \(event\) => \{[\s\S]*state\.sheetDismissed = true;[\s\S]*render\(\);[\s\S]*\}\);/m, "outside taps should dismiss the open feedback sheet with the slide-down animation");
assert.match(css, /\.question-prompt-card__title--ox\s*\{[\s\S]*font-family:\s*var\(--font-body-eb\);/, "OX question text should use the NanumSquare subheading font");
assert.match(css, /\.learning-publish-body\[data-page="learning-passage-mc"\] \.question-block__title\s*\{[\s\S]*font-family:\s*var\(--font-body-eb\);/, "passage MC question text should use the NanumSquare subheading font");
assert.match(prototypeResultHtml, /data-hanja-modal/, "prototype result screen should include the hanja modal container");
assert.match(prototypeResultHtml, /data-hanja-list/, "prototype result screen should include the hanja modal content slot");

console.log("learning ui regression checks passed");
