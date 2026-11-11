import { describe, expect, it } from "vitest";

const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync(path: string, encoding: "utf8"): string };
const css = fs.readFileSync(`${(globalThis as { process?: { cwd(): string } }).process!.cwd()}/src/styles/app.css`, "utf8");
const rule = (selector: string) => {
  const i = css.indexOf(selector);
  expect(i, selector).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf("}", i));
};

describe("narrow Settings and Lists", () => {
  it("the category or list column shrinks, then stacks above the page", () => {
    expect(rule(".sheet-main[data-narrow] .split {")).toContain("var(--sp-200) minmax(0, 1fr)");
    expect(rule(".sheet-main[data-tight] .split {")).toContain("grid-template-columns: minmax(0, 1fr)");
  });

  it("a row grows and wraps its controls instead of overlapping the next row", () => {
    expect(rule(".sheet-main[data-narrow] .kv {")).toContain("flex-wrap: wrap");
    expect(rule('.sheet-main[data-narrow] .kv[style*="height"] {')).toContain("height: auto !important");
    expect(rule(".sheet-main[data-narrow] .ctl {")).toContain("flex-wrap: wrap");
  });
});
