import { describe, expect, it } from "vitest";

/**
 * The splash as the page ships it: it must be in index.html before the bundle (that is the whole point: it paints
 * before any JavaScript), it must draw the mark and no words, and every value must come from tokens.css.
 */
const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync(path: string, encoding: "utf8"): string };
const cwd = (globalThis as { process?: { cwd(): string } }).process!.cwd();
const html = fs.readFileSync(`${cwd}/index.html`, "utf8");
const css = fs.readFileSync(`${cwd}/src/styles/boot.css`, "utf8");

describe("Boot splash (Planner Designs p-splash)", () => {
  it("is in index.html, before the bundle, and draws the mark with no words", () => {
    const start = html.indexOf('<div id="boot"');
    expect(start).toBeGreaterThan(0);
    expect(start).toBeLessThan(html.indexOf("/src/main.tsx"));
    expect(html).toContain('<link rel="stylesheet" href="/src/styles/boot.css" />');
    expect(html).toContain('role="status" aria-label="Opening Orbyn Planner"');
    // Parsed, so the assertions are about the element and not about a slice of the file.
    const boot = new DOMParser().parseFromString(html, "text/html").getElementById("boot");
    // The mono drawing: the dot knocked out of the ring, then the dot itself.
    expect(boot?.querySelector("mask#boot-knock")).not.toBeNull();
    expect(boot?.querySelector('circle[r="124.5"]')).not.toBeNull();
    expect(boot?.querySelector('circle[r="31"]')).not.toBeNull();
    // Nothing to read on screen: the element holds the svg and no words.
    expect(boot?.textContent?.trim()).toBe("");
  });

  it("shows the window once the markup is parsed, so the first thing on screen is the splash", () => {
    // The shell creates the window hidden; this is the page's one call that shows it, with the frame time recorded.
    expect(html).toContain('document.documentElement.dataset.bootShown = String(Date.now());');
    expect(html).toContain('internals.invoke("show_window", { background: background })');
    // The window's colour in the frames before the first paint is the page's own, not white.
    expect(html).toContain("getComputedStyle(document.documentElement).backgroundColor");
    expect(html.indexOf("show_window")).toBeGreaterThan(html.indexOf('<div id="boot"'));
    expect(html.indexOf("show_window")).toBeLessThan(html.indexOf("/src/main.tsx"));
  });

  it("is visible from the first frame, on the window background in the secondary ink, at 64 px, from tokens only", () => {
    expect(css).toContain('@import "./tokens.css";');
    // The page itself is the app's colour before any bundle, font or WebAssembly arrives.
    expect(css).toContain("html { background: var(--bg); }");
    expect(css).toContain("background: var(--bg);");
    expect(css).toContain("color: var(--t2);");
    expect(css).toContain("width: var(--sp-64);");
    expect(css).toContain("height: var(--sp-64);");
    // No literal colour, length or duration: the tokens carry every one.
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b\d+(?:\.\d+)?(?:ms|s)\b/);
    expect(css).not.toMatch(/\b\d+(?:\.\d+)?px\b/);
  });

  it("fades out over the first screen and never moves", () => {
    expect(css).toContain("opacity: 1;");
    expect(css).toContain("transition: opacity var(--m-fast) var(--m-out);");
    expect(css).toContain("html[data-booted] #boot { opacity: 0; }");
    // The only thing that changes is opacity: no keyframes, no transform, no wait before it appears.
    expect(css).not.toContain("@keyframes");
    expect(css).not.toContain("transform");
    expect(css).not.toContain("data-wait");
  });
});
