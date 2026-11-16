import { describe, expect, it } from "vitest";

const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync(path: string, encoding: "utf8"): string };
const css = fs.readFileSync(`${(globalThis as { process?: { cwd(): string } }).process!.cwd()}/src/styles/app.css`, "utf8");
const rule = (selector: string, from = 0) => {
  const i = css.indexOf(selector, from);
  expect(i, selector).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf("}", i));
};

describe("task motion (Motion Designs checkbox, checkoff)", () => {
  it("the box fills in 150 ms and the tick fades in from scale .4 with the motion tokens", () => {
    expect(rule("input.check {")).toContain("transition: background-color var(--m-fast) var(--m-out), border-color var(--m-fast) var(--m-out)");
    const tick = rule("input.check::after {");
    expect(tick).toContain("opacity: 0");
    expect(tick).toContain("scale(.4)");
    expect(tick).toContain("opacity var(--m-fast) var(--m-out), transform var(--m-fast) var(--m-out)");
    expect(rule("input.check:checked::after")).toContain("scale(1)");
  });

  it("under reduced motion the tick is full size", () => {
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce) {\n  input.check::after"));
    expect(reduced.slice(0, 120)).toContain("scale(1)");
  });

  it("the strike grows from the left in 300 ms (scaleX), and the text turns quiet in 200 ms", () => {
    expect(rule(".tr .tt, .row .what")).toContain("transition: color var(--m-base) var(--m-out)");
    const line = rule(".tr .tt::after");
    expect(line).toContain("transform: scaleX(0)");
    expect(line).toContain("transform-origin: left center");
    expect(line).toContain("transform var(--m-slow) var(--m-out)");
    expect(rule(".tr.done .tt::after")).toContain("scaleX(1)");
  });

  it("under reduced motion the strike appears with a fade and no scaling", () => {
    const reduced = rule("@media (prefers-reduced-motion: reduce) {\n  .tr .tt::after", css.indexOf("Motion Designs `checkoff`"));
    expect(reduced).toContain("transform: scaleX(1)");
    expect(reduced).toContain("transition-property: opacity");
  });
});
