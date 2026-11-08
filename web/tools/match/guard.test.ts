// @vitest-environment node
import { build } from "vite";
import { describe, expect, it } from "vitest";
import { FIXTURE_MARKER, LOCALE, PINNED_NOW, SCENARIOS, TIME_ZONE, sampleStrings } from "./fixture";
import { seededStore } from "./mount";
import frames from "./frames.json";

// The match kit (fixture, demo page, runner) is for development and tests only. These checks fail the build when any of it, or any of its
// sample data, reaches a production or staging bundle, and when the fixture could reach an engine. Read docs/match-kit.md.

const app = import.meta.glob<string>("/src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true });
const kit = import.meta.glob<string>("/tools/match/*.{ts,tsx,html,json}", { query: "?raw", import: "default", eager: true });
const runner = import.meta.glob<string>("/scripts/match.mjs", { query: "?raw", import: "default", eager: true });
const isTest = (path: string) => /\.test\.tsx?$/.test(path);

describe("the match kit stays out of the app", () => {
  it("no app file imports from tools/", () => {
    const offenders = Object.entries(app)
      .filter(([path, code]) => !isTest(path) && /["'][^"']*\/tools\/match[^"']*["']|tools\/match/.test(code))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
    expect(Object.keys(app).length).toBeGreaterThan(50); // the scan sees the app
  });

  it("the kit imports no real engine code and calls no network API; its pretend account is in-process", () => {
    const files = Object.entries(kit).filter(([path]) => !isTest(path));
    expect(files.map(([p]) => p)).toEqual(expect.arrayContaining(["/tools/match/fixture.ts", "/tools/match/mount.tsx", "/tools/match/main.tsx", "/tools/match/account.ts", "/tools/match/noSocket.ts"]));
    // The only engine-side modules the kit may import: the crypto registry, the in-memory key store, the in-process mock engine, the engine's module as the sync tests load it, the
    // service type, and the sync tests' mock-engine rig. Everything else (the real engine address, session, sockets) stays out.
    const allowed = new Set(["../../src/api/authCrypto", "../../src/api/keyStore", "../../src/api/testing/MockEngine", "../../src/api/testing/realModule", "../../src/auth/services", "../../src/sync/testing/rig"]);
    const offenders: string[] = [];
    for (const [path, code] of files) {
      const imports = [...code.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
      for (const target of imports) if (/\/(api|auth|sync)\/|\/engine|\/generated\//.test(target) && !allowed.has(target)) offenders.push(`${path} imports ${target}`);
      const code0 = code.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      for (const word of ["fetch(", "XMLHttpRequest", "EventSource", "sendBeacon", "VITE_ENGINE_URL"]) if (code0.includes(word)) offenders.push(`${path} uses ${word}`);
      // The page's socket is replaced by one that never opens: the word may appear only there, and never with `new`.
      if (code0.includes("WebSocket") && !path.endsWith("/noSocket.ts")) offenders.push(`${path} uses WebSocket`);
      if (/new\s+WebSocket/.test(code0)) offenders.push(`${path} opens a WebSocket`);
    }
    expect(offenders).toEqual([]);
  });

  it("the runner only reaches the dev server, and its pinned values are the fixture's", () => {
    const code = Object.values(runner)[0]!;
    expect(code).toContain(`const PINNED_NOW = "${PINNED_NOW}"`);
    expect(code).toContain(`const TIME_ZONE = "${TIME_ZONE}"`);
    expect(code).toContain(`const LOCALE = "${LOCALE}"`);
    expect(code).toContain("url.origin !== origin"); // a request anywhere else fails the run
    expect(code).toContain("problems.push");
  });

  it("every frame names a scenario that exists", () => {
    for (const [id, frame] of Object.entries(frames)) expect(SCENARIOS, id).toContain(frame.scenario);
  });
});

describe("the production and staging builds contain none of it", () => {
  async function output(define: Record<string, string>): Promise<{ names: string[]; text: string }> {
    const root = new URL("../..", import.meta.url).pathname;
    const result = await build({ root, logLevel: "silent", build: { write: false }, define });
    const outputs = Array.isArray(result) ? result : "output" in result ? [result] : [];
    const items = outputs.flatMap((r) => r.output);
    const text = items.map((o) => ("code" in o ? o.code : typeof o.source === "string" ? o.source : "")).join("\n");
    return { names: items.map((o) => o.fileName), text };
  }

  async function sample(): Promise<string[]> {
    const strings = new Set<string>();
    for (const scenario of SCENARIOS) for (const s of sampleStrings(await seededStore(scenario))) strings.add(s);
    // Short words ("Work", "Home") are ordinary copy of the app; the distinctive sample text is what must stay out.
    return [...strings].filter((s) => s.length >= 8);
  }

  it.each([
    ["production", { "import.meta.env.VITE_ENGINE_URL": "undefined" }],
    ["staging", { "import.meta.env.VITE_ENGINE_URL": JSON.stringify("https://api-staging.orbyn.dev") }],
  ])("%s", async (_name, define) => {
    const strings = await sample();
    expect(strings).toContain("Team planning: spring launch"); // the list is the real sample data
    const { names, text } = await output(define);
    expect(text.length).toBeGreaterThan(10_000); // it really built the app
    expect(names.filter((n) => /tools|match|fixture/i.test(n))).toEqual([]);
    for (const needle of [FIXTURE_MARKER, "tools/match", "tools/match/index.html", "__match-engine", ...strings]) {
      expect(text.includes(needle), `the build contains "${needle}"`).toBe(false);
    }
  }, 240_000);
});
