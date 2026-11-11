import { describe, expect, it } from "vitest";

const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync(path: string, encoding: "utf8"): string };
const css = fs.readFileSync(`${(globalThis as { process?: { cwd(): string } }).process!.cwd()}/src/styles/app.css`, "utf8");
const rule = (selector: string) => {
  const i = css.indexOf(selector);
  expect(i, selector).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf("}", i));
};

describe("narrow Calendar", () => {
  it("the toolbar wraps onto a second line instead of running off the page", () => {
    expect(rule(".sheet-main[data-narrow] .ph:has(.pills) {")).toContain("flex-wrap: wrap");
    expect(rule(".sheet-main[data-narrow] .ph:has(.pills) .acts {")).toContain("flex-wrap: wrap");
  });

  it("the side column goes under the grid, and a week scrolls sideways at a readable column width", () => {
    expect(rule(".sheet-main[data-narrow] .calwrap, .sheet-main[data-narrow] .calwrap.day {")).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(rule(".sheet-main[data-narrow] .calwrap:not(.day) .calmain > * {")).toContain("min-width: var(--sp-540)");
  });
});
