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

  it("waits 400 ms from the first frame, so a fast open never flashes it", () => {
    // The wait is started one frame after the element first paints at opacity 0; the 400 ms itself is in the CSS.
    expect(html).toContain('boot.setAttribute("data-wait", "")');
    expect(html.indexOf("requestAnimationFrame")).toBeGreaterThan(html.indexOf('<div id="boot"'));
    expect(css).toContain("#boot[data-wait] { opacity: 1; }");
    expect(css).toContain("transition: opacity var(--m-fast) var(--m-out) var(--m-wait);");
  });

  it("sits on the window background in the secondary ink, at 64 px, from tokens only", () => {
    expect(css).toContain('@import "./tokens.css";');
    expect(css).toContain("background: var(--bg);");
    expect(css).toContain("color: var(--t2);");
    expect(css).toContain("width: var(--sp-64);");
    expect(css).toContain("height: var(--sp-64);");
    // No literal colour, length or duration: the tokens carry every one (0s is "no wait", the way tokens.css writes it).
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(?!0s\b)\d+(?:\.\d+)?(?:ms|s)\b/);
    expect(css).not.toMatch(/\b\d+(?:\.\d+)?px\b/);
  });

  it("fades out from wherever it is, with no wait left, and never moves", () => {
    expect(css).toContain("html[data-booted] #boot { opacity: 0; transition-delay: 0s; }");
    // The only thing that changes is opacity: no keyframes, no transform anywhere.
    expect(css).not.toContain("@keyframes");
    expect(css).not.toContain("transform");
    // Reduced motion keeps the wait, or the mark flashes on a fast open.
    expect(css).toContain("#boot { transition-delay: var(--m-wait) !important; }");
  });
});
