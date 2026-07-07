import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const css = readFileSync(new URL("../shared/css/learning-components.css", import.meta.url), "utf8");
const prototypeJs = readFileSync(new URL("../prototype/js/learning-prototype-init.js", import.meta.url), "utf8");

assert.match(
  css,
  /\.learning-publish-body\[data-page="learning-vocab-card"\] \.learning-content\s*\{[\s\S]*overflow:\s*visible;/,
  "vocab card screen should allow neighboring cards to remain visible beyond the content column",
);
assert.match(
  css,
  /\.learning-publish-body\[data-page="learning-vocab-card"\] \.learning-content__inner\s*\{[\s\S]*height:\s*100%;[\s\S]*width:\s*100%;[\s\S]*min-height:\s*0;[\s\S]*min-width:\s*0;/,
  "vocab card content column should fill the viewport without creating an extra scroll area",
);
assert.match(
  css,
  /\.learning-publish-body\[data-page="learning-vocab-card"\] \.word-card-stage\s*\{[\s\S]*flex:\s*1 1 auto;[\s\S]*min-width:\s*0;[\s\S]*justify-content:\s*center;[\s\S]*overflow:\s*visible;/,
  "word card stage should center itself without clipping the card viewport",
);
assert.match(
  css,
  /\.learning-publish-body\[data-page="learning-vocab-card"\] \.word-card-proto-viewport\s*\{[\s\S]*flex:\s*1 1 auto;[\s\S]*min-width:\s*0;[\s\S]*max-width:\s*100%;[\s\S]*display:\s*flex;[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*flex-start;[\s\S]*overflow:\s*visible;/,
  "card viewport should vertically center the active card area without clipping it",
);
assert.match(
  css,
  /\.learning-publish-body\[data-page="learning-vocab-card"\] \.word-card-proto-card\s*\{[\s\S]*height:\s*clamp\(360px,\s*calc\(100dvh - 264px\),\s*480px\);/,
  "prototype word cards should keep an explicit height so the flipped faces do not collapse to zero",
);
assert.match(
  css,
  /\.learning-publish-body\[data-page="learning-vocab-card"\] \.word-card-proto-card \.word-card__body\s*\{[\s\S]*padding:\s*20px 12px 0 24px;[\s\S]*overflow:\s*hidden;/,
  "prototype vocab card body should keep reveal items inside the card boundary without leaving a bottom gutter",
);
assert.match(
  css,
  /\.learning-publish-body\[data-page="learning-vocab-card"\] \.word-card-proto-card \.word-card__sections\s*\{[\s\S]*max-height:\s*100%;[\s\S]*overflow-y:\s*auto;[\s\S]*overflow-x:\s*hidden;[\s\S]*padding-bottom:\s*0;/,
  "prototype vocab card sections should scroll inside the card without spilling past the border",
);
assert.match(
  css,
  /\.learning-publish-body\[data-page="learning-vocab-card"\] \.word-card-proto-card \.word-card__section:last-child\s*\{[\s\S]*padding-bottom:\s*8px;/,
  "prototype vocab card example section should keep a small 8px bottom breathing room",
);
assert.match(
  prototypeJs,
  /<div class="hanja-modal__meta-row"><span>부수<\/span><strong>\$\{escapeHtml\(entry\.radical\)\}<\/strong><\/div>/,
  "prototype hanja modal should render the radical row",
);
assert.match(
  prototypeJs,
  /elements\.modalList\.innerHTML = rows\.map\(\(entry\) => createHanjaRowMarkup\(entry\)\)\.join\(\"\"\);/,
  "prototype hanja modal should populate the detail rows when the info icon is tapped",
);

console.log("prototype vocab card regression checks passed");
