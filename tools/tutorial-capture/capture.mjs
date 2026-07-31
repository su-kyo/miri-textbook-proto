// 글자 맞추기 튜토리얼 영상 생성 스크립트.
// capture.html 의 CSS 애니메이션을 프레임 단위로 고정 캡처한 뒤 ffmpeg 로 MP4 인코딩한다.
// 실시간 녹화가 아니라 Web Animations API 로 시간을 스텝하므로 프레임 드랍이 없고,
// 마지막 프레임이 첫 프레임으로 정확히 이어져 루프 이음새가 생기지 않는다.
//
// 사용법 (이 폴더에서):
//   npm install
//   node capture.mjs --base http://127.0.0.1:8000 --out ../../asset/video/tutorial
//
// 요구 사항: ffmpeg (PATH), Chromium 실행 파일 (--chromium 또는 Playwright 캐시 자동 탐지)

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const scriptDir = dirname(fileURLToPath(import.meta.url));

function readArg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const FPS = 30;
const baseUrl = readArg("base", "http://127.0.0.1:8000");
const outDir = resolve(scriptDir, readArg("out", "../../asset/video/tutorial"));
const workDir = resolve(readArg("work", join(tmpdir(), "letter-tutorial-frames")));

// Playwright 캐시에서 headless shell 을 찾는다. 없으면 --chromium 으로 직접 지정한다.
function findChromium() {
  const explicit = readArg("chromium", null);
  if (explicit) {
    return explicit;
  }

  const cacheRoot = join(homedir(), "Library", "Caches", "ms-playwright");
  if (!existsSync(cacheRoot)) {
    return null;
  }

  const entries = readdirSync(cacheRoot)
    .filter((name) => name.startsWith("chromium_headless_shell-"))
    .sort()
    .reverse();
  for (const entry of entries) {
    const candidate = join(cacheRoot, entry, "chrome-headless-shell-mac-arm64", "chrome-headless-shell");
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

const SCENES = [
  { scene: "swap", durationMs: 4200 },
  { scene: "fill", durationMs: 5600 },
];
const THEMES = ["light", "dark"];

const executablePath = findChromium();
const browser = executablePath
  ? await chromium.launch({ executablePath })
  : await chromium.launch({ channel: "chrome", headless: true });

mkdirSync(outDir, { recursive: true });

for (const { scene, durationMs } of SCENES) {
  for (const theme of THEMES) {
    const label = `letter-${scene}-${theme}`;
    const framesDir = join(workDir, label);
    rmSync(framesDir, { recursive: true, force: true });
    mkdirSync(framesDir, { recursive: true });

    const page = await browser.newPage({
      viewport: { width: 280, height: 180 },
      deviceScaleFactor: 2,
    });
    await page.goto(`${baseUrl}/tools/tutorial-capture/capture.html?scene=${scene}&theme=${theme}`, {
      waitUntil: "networkidle",
    });

    await page.evaluate(() => {
      document.getAnimations().forEach((animation) => animation.pause());
    });

    // 0%와 100% 키프레임이 같으므로 마지막 중복 프레임은 캡처하지 않는다.
    const frameCount = Math.round((durationMs / 1000) * FPS);
    for (let frame = 0; frame < frameCount; frame += 1) {
      const timeMs = (frame * 1000) / FPS;
      await page.evaluate((currentTime) => {
        document.getAnimations().forEach((animation) => {
          animation.currentTime = currentTime;
        });
      }, timeMs);
      await page.screenshot({
        path: join(framesDir, `${String(frame).padStart(4, "0")}.png`),
        clip: { x: 0, y: 0, width: 280, height: 180 },
      });
    }

    await page.close();

    const outFile = join(outDir, `${label}.mp4`);
    execFileSync("ffmpeg", [
      "-y",
      "-framerate", String(FPS),
      "-i", join(framesDir, "%04d.png"),
      "-c:v", "libx264",
      "-preset", "slow",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "-an",
      outFile,
    ], { stdio: ["ignore", "ignore", "inherit"] });

    console.log(`✔ ${outFile} (${frameCount} frames, ${durationMs}ms loop)`);
  }
}

await browser.close();
console.log("완료: 프레임 작업 폴더는", workDir);
