/* global document, getComputedStyle */
// DEVELOPMENT ONLY: renders one planner screen and the design frame it should match, side by side. See docs/match-kit.md.
//   node scripts/match.mjs <frame-id>... [--theme light|dark|dim|all] [--out <folder>] [--pr <name>] [--ours-only]   (several frames share one server; "all" is every frame)
// Needs Playwright and a Chrome it can launch already on this machine (nothing is downloaded): see the doc.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { collect, diffStructure, unexplained } from "../tools/match/structure.mjs";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(web, "..");
const frames = JSON.parse(readFileSync(join(web, "tools/match/frames.json"), "utf8"));
const THEMES = ["light", "dark", "dim"];
// Kept in step with tools/match/fixture.ts (the guard test checks it).
const PINNED_NOW = "2026-11-07T08:30:00.000Z";
const TIME_ZONE = "UTC";
const LOCALE = "en-GB";
const SIZE = { desktop: { width: 1160, height: 700 }, phone: { width: 390, height: 730 } };
/** A second, wider desktop. With --wide every desktop frame is also drawn here and its structure compared with the 1160 px one. */
const WIDE = { width: 1440, height: 700 };
const RESPONSIVE = JSON.parse(readFileSync(join(web, "tools/match/responsive.json"), "utf8"));
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
  const out = { frames: [], theme: "all", out: null, pr: null, wide: false, oursOnly: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--theme") out.theme = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--pr") out.pr = argv[++i];
    else if (a === "--wide") out.wide = true;
    else if (a === "--ours-only") out.oursOnly = true;
    else if (a.startsWith("-")) fail(`unknown option ${a}`);
    else out.frames.push(a);
  }
  if (out.frames.includes("all")) out.frames = Object.keys(frames);
  if (out.frames.length === 0) fail(`give a frame id. Known: ${Object.keys(frames).join(", ")}`);
  for (const f of out.frames) if (!frames[f]) fail(`unknown frame "${f}". Known: ${Object.keys(frames).join(", ")}`);
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
/** The frame being compared (set by the loop at the end). */
let frame;
let name;
const themes = options.theme === "all" ? THEMES : [options.theme];
const outDir = resolve(options.out ?? join(repo, ".match", options.pr ?? branchName()));
mkdirSync(outDir, { recursive: true });

// --ours-only draws the planner alone: the design page is never read, so it can run where the designs are not (and must not be).
const html = options.oursOnly ? "" : designHtml().replace("<head>", `<head><meta charset="utf-8"><style>${FONT_CSS}</style>`);
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
const differences = [];
const failed = [];

/** Only the dev server's own address may be reached; an engine path on it fails too. */
async function guardNetwork(context, label, strict = true) {
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (url.origin !== origin && frame.feedHost && url.hostname === frame.feedHost) {
      // A calendar feed the frame subscribes to: answered here (never reaches a real host).
      if (frame.feed === "hang") return;
      return route.fulfill({ status: 404, contentType: "text/plain", body: "not found" });
    }
    if (url.origin !== origin) {
      // The design page asks Google Fonts for its fonts; they are provided locally, so that request just fails.
      if (strict) problems.push(`${label}: request to ${url.origin}${url.pathname}`);
      return route.abort();
    }
    if (url.pathname === `${STUB_ENGINE}/health` && frame.health === "hang") return; // the planner keeps waiting: "syncing"
    if (url.pathname === `${STUB_ENGINE}/health` && frame.health === "fail") return route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
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

/** Runs in the page: every element with text of its own, with where it is (from the screen's corner) and its type. */
function textBoxes([originX, originY]) {
  const out = [];
  const root = document.querySelector(".app") ?? document.body;
  for (const el of root.querySelectorAll("*")) {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.replace(/\s+/g, " ").trim()).join(" ").trim();
    if (!own) continue;
    const style = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (style.display === "none" || style.visibility === "hidden" || r.width === 0 || r.height === 0) continue;
    out.push({ text: own.slice(0, 60), x: Math.round(r.x - originX), y: Math.round(r.y - originY), w: Math.round(r.width), h: Math.round(r.height), size: style.fontSize, weight: style.fontWeight });
  }
  return out;
}

async function ours(theme, size = SIZE[frame.kind], suffix = "") {
  const context = await browser.newContext({ viewport: size, timezoneId: TIME_ZONE, locale: LOCALE, reducedMotion: "reduce", deviceScaleFactor: 1 });
  await guardNetwork(context, "ours");
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(frame.now ?? PINNED_NOW));
  // A frame's own preferences (for example days shown), set before the page starts.
  if (frame.init) await page.addInitScript(frame.init);
  if (frame.prefs) await page.addInitScript((prefs) => localStorage.setItem("orbyn-planner.prefs", JSON.stringify(prefs)), frame.prefs);
  const query = new URLSearchParams({ scenario: frame.scenario, route: frame.route, theme, ...(frame.now ? { now: frame.now } : {}), ...(frame.account === false ? { account: "0" } : frame.account === "out" ? { account: "out" } : {}) });
  await page.goto(`${origin}/tools/match/index.html?${query}`);
  await page.waitForSelector(".app, .authcard, h1", { timeout: 20000 });
  if (frame.offline) await context.setOffline(true);
  for (const step of frame.steps ?? []) {
    if (step.role) await page.getByRole(step.role, { name: step.name }).first().click();
    else if (step.click) await page.locator(step.click).first().click();
    else if (step.fill) await page.locator(step.fill).first().fill(step.valueEval ? String(await page.evaluate(step.valueEval)) : step.value);
    else if (step.time) await page.clock.setFixedTime(new Date(step.time));
    else if (step.type) await page.keyboard.type(step.type);
    else if (step.eval) await page.evaluate(step.eval);
    else if (step.wait) await page.waitForTimeout(step.wait);
    else if (step.focus) await page.locator(step.focus).first().focus();
    else if (step.press) await page.keyboard.press(step.press);
    else if (step.select) await page.locator(step.select).first().selectOption(step.value);
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(3200); // the pretend account's first sync pass and the sync label's one-second hold (SyncLine.tsx)
  const png = join(outDir, `${name.replace("@", "-")}-${theme}-ours${suffix}.png`);
  await page.screenshot({ path: png });
  const text = await page.evaluate(() => document.body.innerText);
  const parts = await page.evaluate(collect);
  const boxes = await page.evaluate(textBoxes, [0, 0]);
  await context.close();
  return { png, text, parts, boxes };
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
  await page.waitForTimeout(frame.fit === "app" ? 1500 : 250); // the sign-in cards of the design fade in
  const box = await app.boundingBox();
  const size = SIZE[frame.kind];
  const top = frame.kind === "phone" ? 51 : 1; // the phone's status bar is device chrome; the desktop title bar is hidden
  const png = join(outDir, `${name.replace("@", "-")}-${theme}-design.png`);
  // A frame that is not a window with a sidebar (the sign-in screens) is taken whole.
  if (frame.fit === "app") await app.screenshot({ path: png });
  else await page.screenshot({ path: png, clip: { x: box.x + 1, y: box.y + top, width: size.width, height: size.height } });
  const text = await app.evaluate((el) => el.innerText);
  const boxes = await app.evaluate((el, [ox, oy]) => {
    const out = [];
    for (const e of el.querySelectorAll("*")) {
      const own = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.replace(/\s+/g, " ").trim()).join(" ").trim();
      if (!own) continue;
      const st = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      if (st.display === "none" || st.visibility === "hidden" || r.width === 0 || r.height === 0) continue;
      out.push({ text: own.slice(0, 60), x: Math.round(r.x - ox), y: Math.round(r.y - oy), w: Math.round(r.width), h: Math.round(r.height), size: st.fontSize, weight: st.fontWeight });
    }
    return out;
  }, [box.x + 1, box.y + top]);
  await context.close();
  return { png, text, boxes };
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
  const png = join(outDir, `${name.replace("@", "-")}-${theme}-side.png`);
  await page.screenshot({ path: png, fullPage: true });
  await context.close();
  return png;
}

/** Where each piece of text is in the design and in ours: a line per text that moved, changed size or weight, or is missing on one side. */
function layoutDiff(ourBoxes, designBoxes) {
  const key = (list) => {
    const seen = new Map();
    return list.map((b) => {
      const n = (seen.get(b.text) ?? 0) + 1;
      seen.set(b.text, n);
      return { ...b, id: `${b.text} #${n}` };
    });
  };
  const o = new Map(key(ourBoxes).map((b) => [b.id, b]));
  const lines = [];
  for (const d of key(designBoxes)) {
    const m = o.get(d.id);
    if (!m) {
      lines.push(`${d.id}: design only (design at ${d.x},${d.y})`);
      continue;
    }
    const parts = [];
    if (m.x !== d.x) parts.push(`x ${m.x - d.x > 0 ? "+" : ""}${m.x - d.x}`);
    if (m.y !== d.y) parts.push(`y ${m.y - d.y > 0 ? "+" : ""}${m.y - d.y}`);
    if (m.w !== d.w) parts.push(`w ${m.w - d.w > 0 ? "+" : ""}${m.w - d.w}`);
    if (m.h !== d.h) parts.push(`h ${m.h - d.h > 0 ? "+" : ""}${m.h - d.h}`);
    if (m.size !== d.size) parts.push(`size ${d.size} -> ${m.size}`);
    if (m.weight !== d.weight) parts.push(`weight ${d.weight} -> ${m.weight}`);
    if (parts.length) lines.push(`${d.id}: ${parts.join(", ")} (ours minus design)`);
    o.delete(d.id);
  }
  for (const m of o.values()) lines.push(`${m.id}: ours only (ours at ${m.x},${m.y})`);
  return lines;
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
  for (const id of options.frames) {
    frame = frames[id];
    name = id;
    try {
      for (const theme of themes) {
        const o = await ours(theme);
        if (options.oursOnly) {
          console.log(o.png);
          continue;
        }
        const d = await design(theme);
        const side = await sideBySide(o.png, d.png, theme);
        if (options.wide && frame.kind === "desktop") {
          const wide = await ours(theme, WIDE, "-1440");
          const lines = diffStructure(o.parts, wide.parts, ["1160 px", "1440 px"]);
          const bad = unexplained(lines, RESPONSIVE);
          writeFileSync(join(outDir, `${name.replace("@", "-")}-${theme}-structure.txt`), (lines.length ? lines.join("\n") : "same structure at 1160 and 1440 px") + "\n");
          if (bad.length > 0) differences.push(`${name} (${theme}) differs between 1160 and 1440 px:\n    ${bad.join("\n    ")}`);
        }
        writeFileSync(join(outDir, `${name.replace("@", "-")}-${theme}-text.txt`), textDiff(o.text, d.text) + "\n");
        writeFileSync(join(outDir, `${name.replace("@", "-")}-${theme}-layout.txt`), layoutDiff(o.boxes, d.boxes).join("\n") + "\n");
        console.log(side);
      }
    } catch (error) {
      // One frame that cannot be rendered (a step that finds nothing) does not stop the others.
      console.error(`match: ${id} failed: ${String(error.message ?? error).split("\n")[0]}`);
      failed.push(id);
    }
  }
} finally {
  await browser.close();
  await server.close();
}
if (differences.length > 0) {
  console.error(`match: the same screen has a different structure at the two desktop widths (see docs/match-kit.md, --wide):\n  ${differences.join("\n  ")}`);
  process.exitCode = 1;
}
if (failed.length > 0) console.error(`match: frames that failed: ${failed.join(", ")}`);
if (problems.length > 0) {
  console.error(`match: the fixture reached outside the dev server:\n  ${[...new Set(problems)].join("\n  ")}`);
  process.exit(1);
}
