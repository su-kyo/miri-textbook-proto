import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const css = readFileSync(new URL("../shared/css/learning-components.css", import.meta.url), "utf8");
const prototypeJs = readFileSync(new URL("../prototype/js/learning-prototype-init.js", import.meta.url), "utf8");
const publishJs = readFileSync(new URL("../publish/js/learning-publish-init.js", import.meta.url), "utf8");

assert.match(css, /--matching-board-max-height:/, "matching board max-height token should exist");
assert.match(css, /\.learning-content--matching\b/, "matching screen should have a dedicated content overflow rule");
assert.match(css, /justify-content:\s*center;/, "matching layout should vertically center the board within the available height");

assert.match(prototypeJs, /function drawPreviewLine\(/, "prototype matching screen should support a drag preview line");
assert.match(prototypeJs, /pointerenter/, "prototype matching screen should respond to drag hover targets");
assert.match(publishJs, /function drawPreviewLine\(/, "publish matching screen should support a drag preview line");
assert.match(publishJs, /pointerenter/, "publish matching screen should respond to drag hover targets");

console.log("matching layout regression checks passed");
