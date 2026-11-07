/* global document */
// DEVELOPMENT ONLY: renders one planner screen and the design frame it should match, side by side. See docs/match-kit.md.
//   node scripts/match.mjs <frame-id> [--theme light|dark|dim|all] [--out <folder>] [--pr <name>]
// Needs Playwright and a Chrome it can launch already on this machine (nothing is downloaded): see the doc.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(web, "..");
const frames = JSON.parse(readFileSync(join(web, "tools/match/frames.json"), "utf8"));
const THEMES = ["light", "dark", "dim"];
// Kept in step with tools/match/fixture.ts (the guard test checks it).
const PINNED_NOW = "2026-11-07T08:30:00.000Z";
const TIME_ZONE = "UTC";
const LOCALE = "en-GB";
const SIZE = { desktop: { width: 1160, height: 700 }, phone: { width: 390, height: 730 } };
/** Paths only an engine answers: a request to one of them from the fixture page fails the run. */
const ENGINE_PATH = /^\/(health|v\d+\/|sync|records|zones|sessions|auth|devices)/;
/** The planner checks an engine's /health. The fixture page's "engine" is this address on the dev server, answered here, so no real engine is ever asked. */
const STUB_ENGINE = "/__match-engine";
process.env.VITE_ENGINE_URL = STUB_ENGINE;

function fail(message) {
  console.error(`match: ${message}`);
  process.exit(1);
}

function args() {
  const out = { frame: null, theme: "all", out: null, pr: null };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--theme") out.theme = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--pr") out.pr = argv[++i];
    else if (a.startsWith("-")) fail(`unknown option ${a}`);
    else out.frame = a;
  }
  if (!out.frame) fail(`give a frame id. Known: ${Object.keys(frames).join(", ")}`);
  if (!frames[out.frame]) fail(`unknown frame "${out.frame}". Known: ${Object.keys(frames).join(", ")}`);
  if (out.theme !== "all" && !THEMES.includes(out.theme)) fail("--theme is light, dark, dim or all");
  return out;
}

function loadPlaywright() {
  const candidates = [process.env.ORBYN_PLAYWRIGHT, join(web, "node_modules")].filter(Boolean);
  for (const base of candidates) {
    for (const name of ["playwright-core", "playwright"]) {
      try {
        const req = createRequire(join(base, "noop.js"));
        return req(name);
      } catch {
        try {
          return createRequire(join(base, "..", "noop.js"))(name);
        } catch {
          // try the next one
        }
      }
    }
  }
  return fail("Playwright is not available. Set ORBYN_PLAYWRIGHT to a folder whose node_modules holds playwright or playwright-core.");
}

function findChrome() {
  if (process.env.ORBYN_CHROME) return process.env.ORBYN_CHROME;
  for (const root of [join(homedir(), "Library/Caches/ms-playwright"), join(homedir(), ".cache/ms-playwright"), join(homedir(), "AppData/Local/ms-playwright")]) {
    if (!existsSync(root)) continue;
    const dirs = readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)));
    for (const d of dirs) {
      for (const rel of [
        "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
        "chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
        "chrome-linux64/chrome",
        "chrome-linux/chrome",
        "chrome-win64/chrome.exe",
      ]) {
        if (existsSync(join(root, d, rel))) return join(root, d, rel);
      }
    }
  }
  return fail("No Chrome found. Set ORBYN_CHROME to a Chrome or Chromium binary.");
}

/** The design page's HTML from the designs repository's origin/main (never its working tree). */
function designHtml() {
  if (process.env.ORBYN_DESIGN_FILE) return readFileSync(process.env.ORBYN_DESIGN_FILE, "utf8");
  const dir = process.env.ORBYN_DESIGNS_DIR;
  if (!dir) fail("Set ORBYN_DESIGNS_DIR to your clone of orbyn-designs (it is read with git show origin/main; run git fetch there first).");
  return execFileSync("git", ["-C", dir, "show", "origin/main:artifacts/planner-designs.html"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function branchName() {
  try {
    return execFileSync("git", ["-C", repo, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim().replace(/[^\w.-]+/g, "-");
  } catch {
    return "local";
  }
}

const FONT_CSS = `
@font-face{font-family:"Geist";font-weight:100 900;src:url(/node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2) format("woff2-variations")}
@font-face{font-family:"JetBrains Mono";font-weight:400;src:url(/node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2) format("woff2")}
@font-face{font-family:"JetBrains Mono";font-weight:500;src:url(/node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2) format("woff2")}
`;

const options = args();
const frame = frames[options.frame];
const themes = options.theme === "all" ? THEMES : [options.theme];
const outDir = resolve(options.out ?? join(repo, ".match", options.pr ?? branchName()));
mkdirSync(outDir, { recursive: true });

const html = designHtml().replace("<head>", `<head><meta charset="utf-8"><style>${FONT_CSS}</style>`);
const { chromium } = loadPlaywright();

const server = await createServer({
  root: web,
  configFile: join(web, "vite.config.ts"),
  logLevel: "error",
  server: { host: "127.0.0.1", port: 5399, strictPort: false },
  plugins: [
    {
      name: "match-design-page",
      configureServer(s) {
        s.middlewares.use("/__match/design.html", (_req, res) => {
          res.setHeader("content-type", "text/html; charset=utf-8");
          res.end(html);
        });
      },
    },
  ],
});
await server.listen();
const origin = server.resolvedUrls.local[0].replace(/\/$/, "");
const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
const problems = [];

/** Only the dev server's own address may be reached; an engine path on it fails too. */
async function guardNetwork(context, label, strict = true) {
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (url.origin !== origin) {
      // The design page asks Google Fonts for its fonts; they are provided locally, so that request just fails.
      if (strict) problems.push(`${label}: request to ${url.origin}${url.pathname}`);
      return route.abort();
    }
    if (url.pathname === `${STUB_ENGINE}/health`) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", version: "match", database: "ok" }) });
    }
    if (url.pathname.startsWith(STUB_ENGINE)) {
      problems.push(`${label}: engine call ${url.pathname}`);
      return route.abort();
    }
    if (ENGINE_PATH.test(url.pathname)) {
      problems.push(`${label}: engine-shaped request ${url.pathname}`);
      return route.abort();
    }
    return route.continue();
  });
}

async function ours(theme) {
  const size = SIZE[frame.kind];
  const context = await browser.newContext({ viewport: size, timezoneId: TIME_ZONE, locale: LOCALE, reducedMotion: "reduce", deviceScaleFactor: 1 });
  await guardNetwork(context, "ours");
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(frame.now ?? PINNED_NOW));
  const query = new URLSearchParams({ scenario: frame.scenario, route: frame.route, theme, ...(frame.now ? { now: frame.now } : {}) });
  await page.goto(`${origin}/tools/match/index.html?${query}`);
  await page.waitForSelector(".app", { timeout: 20000 });
  for (const step of frame.steps ?? []) {
    if (step.role) await page.getByRole(step.role, { name: step.name }).first().click();
    else if (step.click) await page.locator(step.click).first().click();
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const png = join(outDir, `${options.frame.replace("@", "-")}-${theme}-ours.png`);
  await page.screenshot({ path: png });
  const text = await page.evaluate(() => document.body.innerText);
  await context.close();
  return { png, text };
}

async function design(theme) {
  const context = await browser.newContext({ viewport: { width: 1300, height: 1500 }, locale: LOCALE, timezoneId: TIME_ZONE, deviceScaleFactor: 1 });
  await guardNetwork(context, "design", false);
  const page = await context.newPage();
  await page.goto(`${origin}/__match/design.html`);
  await page.evaluate(() => document.fonts.ready);
  const handle = await page.evaluateHandle(([id, index]) => document.querySelectorAll(`#${id} .app`)[index], [frame.design, frame.app ?? 0]);
  const app = handle.asElement();
  if (!app) fail(`the design has no frame "${frame.design}" (app ${frame.app ?? 0})`);
  await app.evaluate((el, t) => {
    el.dataset.th = t;
    el.querySelector(".tb")?.setAttribute("style", "display:none");
  }, theme);
  await app.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  const box = await app.boundingBox();
  const size = SIZE[frame.kind];
  const top = frame.kind === "phone" ? 51 : 1; // the phone's status bar is device chrome; the desktop title bar is hidden
  const png = join(outDir, `${options.frame.replace("@", "-")}-${theme}-design.png`);
  await page.screenshot({ path: png, clip: { x: box.x + 1, y: box.y + top, width: size.width, height: size.height } });
  const text = await app.evaluate((el) => el.innerText);
  await context.close();
  return { png, text };
}

async function sideBySide(a, b, theme) {
  const context = await browser.newContext({ viewport: { width: 100, height: 100 } });
  const page = await context.newPage();
  const data = (p) => `data:image/png;base64,${readFileSync(p).toString("base64")}`;
  await page.setContent(
    `<body style="margin:0;background:#888;font:12px sans-serif;color:#fff"><div style="display:flex;gap:12px;padding:8px;align-items:flex-start">` +
      `<figure style="margin:0"><figcaption>ours · ${theme}</figcaption><img src="${data(a)}"></figure>` +
      `<figure style="margin:0"><figcaption>design · ${theme}</figcaption><img src="${data(b)}"></figure></div></body>`,
  );
  const png = join(outDir, `${options.frame.replace("@", "-")}-${theme}-side.png`);
  await page.screenshot({ path: png, fullPage: true });
  await context.close();
  return png;
}

/** Lines of text only one side has: a quick read of copy differences, not a verdict. */
function textDiff(ourText, designText) {
  const lines = (t) => t.split("\n").map((l) => l.trim()).filter(Boolean);
  const o = lines(ourText);
  const d = lines(designText);
  const oSet = new Set(o);
  const dSet = new Set(d);
  return [...d.filter((l) => !oSet.has(l)).map((l) => `design only: ${l}`), ...o.filter((l) => !dSet.has(l)).map((l) => `ours only:   ${l}`)].join("\n");
}

try {
  for (const theme of themes) {
    const o = await ours(theme);
    const d = await design(theme);
    const side = await sideBySide(o.png, d.png, theme);
    writeFileSync(join(outDir, `${options.frame.replace("@", "-")}-${theme}-text.txt`), textDiff(o.text, d.text) + "\n");
    console.log(side);
  }
} finally {
  await browser.close();
  await server.close();
}
if (problems.length > 0) {
  console.error(`match: the fixture reached outside the dev server:\n  ${[...new Set(problems)].join("\n  ")}`);
  process.exit(1);
}
