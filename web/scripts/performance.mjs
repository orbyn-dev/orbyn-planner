/** Repeatable local production-browser benchmark. Uses an existing Chromium, no browser/package downloads. */
/* global indexedDB, document, requestAnimationFrame, MutationObserver */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, extname } from "node:path";
import { parseArgs } from "node:util";
import { navigatePage } from "./navigation.mjs";

const { values } = parseArgs({ options: { dist: { type: "string" }, browser: { type: "string" }, out: { type: "string" }, runs: { type: "string", default: "10" }, label: { type: "string", default: "candidate" }, fixtures: { type: "string", default: "small,large" }, smoke: { type: "boolean", default: false }, screenshots: { type: "string" } } });
if (!values.dist || !values.browser || !values.out) throw new Error("Pass --dist path/to/dist --browser existing/chromium.exe --out results.json [--runs 10]");
const dist = resolve(values.dist);
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (pathname === "/__seed") { response.setHeader("Content-Type", "text/html"); response.end("<!doctype html><title>Synthetic benchmark setup</title>"); return; }
    const file = resolve(dist, `.${pathname}`);
    if (!file.startsWith(dist + "/") && !file.startsWith(dist + "\\")) { response.writeHead(403).end(); return; }
    let bytes;
    let extension = extname(file);
    try { bytes = await readFile(file); } catch { bytes = await readFile(join(dist, "index.html")); extension = ".html"; }
    response.setHeader("Content-Type", ({ ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".wasm": "application/wasm", ".woff2": "font/woff2", ".woff": "font/woff" })[extension] ?? "application/octet-stream");
    response.setHeader("Cache-Control", pathname.startsWith("/assets/") ? "public, max-age=3600" : "no-cache");
    response.end(bytes);
  } catch (error) { response.writeHead(500).end(String(error)); }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(join(tmpdir(), "orbyn-planner-benchmark-"));
const chrome = spawn(values.browser, ["--headless", "--disable-gpu", "--no-first-run", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
const endpoint = await new Promise((done, reject) => {
  let stderr = "";
  const timeout = setTimeout(() => reject(new Error("Chromium did not expose DevTools")), 20000);
  chrome.on("error", reject);
  chrome.stderr.on("data", (chunk) => { stderr += chunk; const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timeout); done(match[1]); } });
});
let socket;
const results = [];
try {
  socket = new WebSocket(endpoint);
  await new Promise((done, reject) => { socket.addEventListener("open", done, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let serial = 0;
  const pending = new Map();
  const handlers = new Set();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) { const request = pending.get(message.id); if (!request) return; clearTimeout(request.timeout); pending.delete(message.id); if (message.error) request.reject(new Error(JSON.stringify(message.error))); else request.done(message.result); }
    else for (const handler of handlers) handler(message);
  });
  const send = (method, params = {}, sessionId) => new Promise((done, reject) => {
    const id = ++serial;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`DevTools timeout: ${method}`)); }, 45000);
    pending.set(id, { done, reject, timeout });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const evaluate = async (session, expression) => {
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, session);
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  for (const fixture of values.fixtures.split(",")) {
    for (let run = 0; run < Number(values.runs); run++) {
      const { browserContextId } = await send("Target.createBrowserContext");
      const { targetId } = await send("Target.createTarget", { url: "about:blank", browserContextId });
      const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
      await send("Page.enable", {}, sessionId);
      await send("Runtime.enable", {}, sessionId);
      await send("Network.enable", {}, sessionId);
      await send("Page.addScriptToEvaluateOnNewDocument", { source: `(${observeUsability.toString()})()` }, sessionId);
      await send("Page.navigate", { url: `${origin}/__seed` }, sessionId);
      await evaluate(sessionId, `new Promise(resolve => { if(document.readyState==='complete') resolve(); else window.addEventListener('load', resolve, {once:true}); })`);
      const seed = await evaluate(sessionId, `(${seedDatabase.toString()})(${JSON.stringify(fixture)})`);
      // The first navigation records one-time schema/backfill separately from matched steady cold/warm runs.
      for (const mode of ["initial", "cold", "warm"]) {
        const errors = [];
        const requests = [];
        const listen = (message) => {
          if (message.sessionId !== sessionId) return;
          if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
          if (message.method === "Network.responseReceived") requests.push({ url: message.params.response.url.replace(origin, ""), cache: !!message.params.response.fromDiskCache, type: message.params.type });
        };
        handlers.add(listen);
        await send("Network.setCacheDisabled", { cacheDisabled: mode !== "warm" }, sessionId);
        if (mode !== "warm") await send("Network.clearBrowserCache", {}, sessionId);
        await navigatePage(send, handlers, socket, sessionId, `${origin}/today`);
        const metrics = await evaluate(sessionId, `(${measurePage.toString()})()`);
        handlers.delete(listen);
        const result = { label: values.label, fixture, run: run + 1, mode, seed, ...metrics, requests, errors };
        results.push(result);
        console.log(JSON.stringify({ fixture, run: run + 1, mode, firstUsableMs: metrics.firstUsableMs, fullReadyMs: metrics.fullReadyMs, mountedRows: metrics.mountedRows, wasm: requests.some((r) => r.url.endsWith('.wasm')), errors }));
      }
      if (values.smoke && run === 0) results.push({ label: values.label, fixture, browserSmoke: await smokeReview(send, evaluate, sessionId, values.screenshots, fixture) });
      await send("Target.disposeBrowserContext", { browserContextId });
    }
  }
  await mkdir(resolve(values.out, ".."), { recursive: true });
  await writeFile(values.out, JSON.stringify({ capturedAt: new Date().toISOString(), browser: values.browser, dist, runs: results }, null, 2));
  const failed = results.filter((r) => r.errors?.length || r.timeout);
  if (failed.length) throw new Error(`${failed.length} benchmark runs failed; see ${values.out}`);
} finally {
  socket?.close();
  chrome.kill();
  server.close();
  // Only the fresh profile created by this invocation is eligible for removal.
  if (resolve(profile).startsWith(resolve(tmpdir()) + "\\orbyn-planner-benchmark-") || resolve(profile).startsWith(resolve(tmpdir()) + "/orbyn-planner-benchmark-")) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

async function seedDatabase(fixture) {
  localStorage.setItem("orbyn-planner.local-only", "1");
  localStorage.setItem("orbyn-planner.first-run.local", "done");
  const count = fixture === "small" ? 100 : 10000;
  const eventCount = fixture === "small" ? 50 : 5000;
  const today = new Date();
  const day = (offset) => { const date = new Date(today); date.setDate(date.getDate() + offset); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
  const now = today.toISOString();
  const request = indexedDB.open("orbyn-planner", 6);
  request.onupgradeneeded = () => {
    for (const name of ["tasks", "lists", "events", "calendars", "projects", "tags"]) request.result.createObjectStore(name, { keyPath: "id" });
    request.result.createObjectStore("purgedTags");
    request.result.createObjectStore("outbox", { keyPath: "seq", autoIncrement: true }).createIndex("record", ["type", "id"], { unique: true });
  };
  const db = await new Promise((done, reject) => { request.onsuccess = () => done(request.result); request.onerror = () => reject(request.error); });
  const started = performance.now();
  await new Promise((done, reject) => {
    const tx = db.transaction([...db.objectStoreNames], "readwrite");
    tx.objectStore("lists").put({ id: "inbox", name: "Inbox", colour: "c1", isInbox: true });
    tx.objectStore("calendars").put({ id: "personal", name: "Personal", colour: "c2", visible: true, kind: { type: "local" } });
    for (let i = 0; i < count; i++) {
      const done = fixture !== "dense" && i < count * .8;
      const due = fixture === "dense" ? day(0) : done ? day(-100 - i % 600) : day(i % 30 - 5);
      tx.objectStore("tasks").put({ id: `fixture-task-${i}`, title: `Synthetic task ${i}`, notes: "Synthetic benchmark record", listId: "inbox", due, priority: "none", done, completedAt: done ? `${due}T12:00:00Z` : null, deletedAt: null, checklist: [], tags: [], projectId: null, sectionId: null, repeat: null, reminder: null, completions: [], overrideOf: null, createdAt: now, updatedAt: now });
    }
    for (let i = 0; i < eventCount; i++) {
      const date = fixture === "dense" ? day(0) : day(i % 730 - 600);
      tx.objectStore("events").put({ id: `fixture-event-${i}`, title: `Synthetic event ${i}`, calendarId: "personal", allDay: false, start: `${date}T10:00`, end: `${date}T11:00`, place: "", notes: "", people: [], reminder: null, repeat: null, zone: null, overrideOf: null, readOnly: false, deletedAt: null, createdAt: now, updatedAt: now });
    }
    tx.oncomplete = done;
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
  db.close();
  return { tasks: count, events: eventCount, seedMs: performance.now() - started };
}

async function measurePage() {
  const started = performance.now();
  let firstUsableMs;
  let fullReadyMs;
  let partialMs;
  return new Promise((done) => {
    const frame = () => {
      firstUsableMs = performance.getEntriesByName("planner:benchmark-usable")[0]?.startTime;
      const ready = performance.getEntriesByName("planner:store-ready")[0];
      if (ready) fullReadyMs = ready.startTime;
      const partial = performance.getEntriesByName("planner:store-partial")[0];
      if (partial) partialMs = partial.startTime;
      const elapsed = performance.now() - started;
      if ((firstUsableMs !== undefined && fullReadyMs !== undefined && elapsed > 2200) || elapsed > 30000) {
        done({ firstUsableMs, firstEditableMs: performance.getEntriesByName("planner:benchmark-editable")[0]?.startTime, fullReadyMs, partialMs, timeout: firstUsableMs === undefined || fullReadyMs === undefined, mountedRows: document.querySelectorAll("[data-row-id]").length, totalDomNodes: document.querySelectorAll("*").length, resources: performance.getEntriesByType("resource").map((r) => ({ name: new URL(r.name).pathname, duration: r.duration, transferSize: r.transferSize, decodedBodySize: r.decodedBodySize })), storeStartMs: performance.getEntriesByName("planner:store-start")[0]?.startTime });
      } else requestAnimationFrame(frame);
    };
    frame();
  });
}

/** Installed before navigation, with identical DOM and splash conditions for baseline and candidate. */
function observeUsability() {
  let editable = false;
  let scheduled = false;
  const inspect = () => {
    scheduled = false;
    if (!document.querySelector('[data-row-id^="fixture-task-"] input[type="checkbox"]:not(:disabled)')) return;
    if (!editable) { performance.mark("planner:benchmark-editable"); editable = true; }
    if (document.getElementById("boot")) return;
    performance.mark("planner:benchmark-usable");
    observer.disconnect();
  };
  const observer = new MutationObserver(() => { if (!scheduled) { scheduled = true; requestAnimationFrame(inspect); } });
  observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["disabled"] });
}

async function smokeReview(send, evaluate, session, screenshots, fixture) {
  // Pass values through DevTools arguments rather than constructing executable source from them.
  const call = async (fn, ...args) => {
    const global = await send("Runtime.evaluate", { expression: "globalThis" }, session);
    const objectId = global.result.objectId;
    try {
      const result = await send("Runtime.callFunctionOn", { objectId, functionDeclaration: fn.toString(), arguments: args.map((value) => ({ value })), awaitPromise: true, returnByValue: true }, session);
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    } finally { await send("Runtime.releaseObject", { objectId }, session); }
  };
  const wait = (kind, value) => call((kind, value) => new Promise((resolve, reject) => {
    const started = performance.now();
    function check() {
      const ready = kind === "heading" ? [...document.querySelectorAll("h1")].some((h) => h.textContent.includes(value))
        : kind === "selector" ? document.querySelector(value) !== null
          : document.activeElement?.closest("[data-row-id]")?.dataset.rowId === value;
      if (ready) resolve(true);
      else if (performance.now() - started > 15000) reject(new Error(`UI condition timed out: ${kind}`));
      else requestAnimationFrame(check);
    }
    check();
  }), kind, value);
  const frames = () => evaluate(session, "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
  const clickRoute = async (path, heading) => {
    await call((path) => [...document.querySelectorAll("a")].find((a) => a.getAttribute("href") === path).click(), path);
    await wait("heading", heading);
    await frames();
  };
  const capture = async (name) => {
    if (!screenshots) return;
    await mkdir(screenshots, { recursive: true });
    await evaluate(session, "document.fonts.ready");
    const { data } = await send("Page.captureScreenshot", { format: "png" }, session);
    await writeFile(join(screenshots, `${fixture}-${name}.png`), Buffer.from(data, "base64"));
  };
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, session);
  await clickRoute("/tasks", "Tasks");
  const listCount = await evaluate(session, "document.querySelectorAll('[data-row-id]').length");
  if (fixture !== "small" && listCount > 250) throw new Error(`Tasks mounted ${listCount} rows`);
  await evaluate(session, "[...document.querySelectorAll('[role=radio]')].find(b=>b.textContent==='Board').click()");
  await wait("selector", ".cards [data-row-id]");
  await frames();
  const geometry = await evaluate(session, `(()=>{for(const list of document.querySelectorAll('.cards')) {const rows=[...list.querySelectorAll(':scope > [data-row-id]')];for(let i=1;i<rows.length;i++){if(+rows[i].dataset.index===+rows[i-1].dataset.index+1){const gap=rows[i].getBoundingClientRect().top-rows[i-1].getBoundingClientRect().bottom;return {gap,expected:parseFloat(getComputedStyle(rows[i-1]).marginBottom),containerGap:getComputedStyle(list).rowGap}}}}return null})()`);
  if (fixture !== "small" && (!geometry || Math.abs(geometry.gap - 8) > 1)) throw new Error(`Card geometry mismatch: ${JSON.stringify(geometry)}`);
  const target = fixture === "small" ? "fixture-task-99" : "fixture-task-9999";
  await call((id) => {
    document.dispatchEvent(new CustomEvent("planner:reveal-row", { detail: id }));
    // Small lists have no reveal subscription because all their rows are already mounted.
    const row = [...document.querySelectorAll("[data-row-id]")].find((element) => element.dataset.rowId === id);
    (row?.matches('[tabindex="0"]') ? row : row?.querySelector("button, input, [tabindex='0']"))?.focus();
  }, target);
  await wait("focus", target);
  const focusGeometry = await evaluate(session, `(()=>{const row=document.activeElement.closest('[data-row-id]');const box=row.getBoundingClientRect();const port=document.querySelector('.sheet-main').getBoundingClientRect();return {top:box.top,bottom:box.bottom,portTop:port.top,portBottom:port.bottom}})()`);
  if (focusGeometry.bottom < focusGeometry.portTop || focusGeometry.top > focusGeometry.portBottom) throw new Error(`Focused row outside viewport: ${JSON.stringify(focusGeometry)}`);
  await capture("board-focus");
  // Completing the focused row exercises real Web Animations and the deletion ghost/measurement boundary.
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", modifiers: 1, windowsVirtualKeyCode: 39 }, session);
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", modifiers: 1, windowsVirtualKeyCode: 39 }, session);
  await frames();
  const movedFocus = await evaluate(session, `document.activeElement?.closest('[data-row-id]')?.dataset.rowId`);
  if (movedFocus !== target) throw new Error(`Moving a board card lost focus: ${movedFocus}`);
  await clickRoute("/today", "Good");
  for (const theme of ["light", "dark", "dim"]) {
    await evaluate(session, `document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
    await frames();
    await capture(`today-${theme}`);
  }
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, session);
  await frames();
  await capture("today-phone");
  const phoneOverflow = await evaluate(session, "document.documentElement.scrollWidth > innerWidth + 1");
  if (phoneOverflow) throw new Error("Phone layout overflows horizontally");
  return { listCount, geometry, focusGeometry, movedFocus, phoneOverflow };
}
