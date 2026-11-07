import { describe, expect, it } from "vitest";

const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync(path: string, encoding: "utf8"): string };
const css = fs.readFileSync(`${(globalThis as { process?: { cwd(): string } }).process!.cwd()}/src/styles/app.css`, "utf8");
const at = css.indexOf("Motion Designs: select, banner, inputerr, syncline");
const block = css.slice(at);
const rule = (selector: string) => {
  const i = block.indexOf(selector);
  expect(i, selector).toBeGreaterThan(-1);
  return block.slice(i, block.indexOf("}", i) + 1);
};

describe("control motion (Motion Designs select, banner, inputerr, syncline)", () => {
  it("a menu opens fading, from 4 px above and scale .98, in 200 ms", () => {
    expect(rule("@keyframes m-pop")).toContain("translateY(-4px) scale(.98)");
    expect(rule(".popover {")).toContain("animation: m-pop var(--m-base) var(--m-out)");
  });

  it("a banner fades in from 8 px above in 200 ms", () => {
    expect(rule("@keyframes m-banner")).toContain("translateY(-8px)");
    expect(rule(".banner {")).toContain("var(--m-base) var(--m-out)");
  });

  it("an error message fades in from 4 px above, and the field's border changes in 150 ms; nothing shakes", () => {
    expect(rule("@keyframes m-err")).toContain("translateY(-4px)");
    expect(rule(".field, .cbox")).toContain("border-color var(--m-fast) var(--m-out)");
    expect(block).not.toMatch(/shake/i);
  });

  it("the sync label fades in over 150 ms", () => {
    expect(rule(".pillx, .st {")).toContain("animation: m-fade var(--m-fast) var(--m-out)");
  });

  it("under reduced motion the menu, banner and message only fade, with no offset", () => {
    const reduced = block.slice(block.indexOf("@media (prefers-reduced-motion: reduce)"));
    for (const name of [".popover", ".banner", ".err, small.err"]) expect(reduced).toContain(`${name} { animation-name: m-fade; }`);
    expect(rule("@keyframes m-fade")).not.toContain("transform");
  });
});
