import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const projectRoot = process.cwd();
const catalogPath = path.join(projectRoot, "data/constellations.json");
const raw = fs.readFileSync(catalogPath, "utf8");
const catalog = JSON.parse(raw);
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "miri-constellation-webp-"));

function pngSourcePath(assetPath, fallbackName) {
  if (!assetPath) {
    return fallbackName;
  }

  if (assetPath.endsWith(".webp")) {
    return assetPath.replace(/\.webp$/u, ".png");
  }

  return assetPath;
}

function webpOutputPath(assetPath, fallbackName) {
  const sourcePath = pngSourcePath(assetPath, fallbackName);
  return sourcePath.replace(/\.png$/u, ".webp");
}

function buildWebpFromPng(sourcePath, outputPath) {
  const absoluteSource = path.join(projectRoot, sourcePath);

  if (!fs.existsSync(absoluteSource)) {
    return false;
  }

  const absoluteOutput = path.join(projectRoot, outputPath);
  fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });

  const resizedPath = path.join(
    tmpRoot,
    `${path.basename(outputPath, ".webp")}-${Math.random().toString(36).slice(2)}.png`,
  );

  execFileSync("sips", ["-z", "400", "400", absoluteSource, "--out", resizedPath], {
    stdio: "ignore",
  });
  execFileSync("cwebp", ["-quiet", "-q", "92", resizedPath, "-o", absoluteOutput], {
    stdio: "ignore",
  });

  return true;
}

let generatedIllustrations = 0;
let generatedHidden = 0;
let droppedHidden = 0;

for (const item of catalog) {
  const illustrationPng = pngSourcePath(
    item.illustration,
    `asset/constellations/${item.id}/${item.id}.png`,
  );
  const illustrationWebp = webpOutputPath(
    item.illustration,
    `asset/constellations/${item.id}/${item.id}.png`,
  );

  if (!buildWebpFromPng(illustrationPng, illustrationWebp)) {
    throw new Error(`Missing illustration source: ${illustrationPng}`);
  }

  item.illustration = illustrationWebp;
  generatedIllustrations += 1;

  const hiddenPng = pngSourcePath(
    item.hidden,
    `asset/constellations/${item.id}/${item.id}_hidden.png`,
  );
  const hiddenWebp = webpOutputPath(
    item.hidden,
    `asset/constellations/${item.id}/${item.id}_hidden.png`,
  );

  if (buildWebpFromPng(hiddenPng, hiddenWebp)) {
    item.hidden = hiddenWebp;
    generatedHidden += 1;
  } else {
    item.hidden = null;
    droppedHidden += 1;
  }
}

fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
fs.rmSync(tmpRoot, { recursive: true, force: true });

console.log(
  JSON.stringify(
    {
      generatedIllustrations,
      generatedHidden,
      droppedHidden,
    },
    null,
    2,
  ),
);
