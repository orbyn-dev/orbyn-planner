import { describe, expect, it } from "vitest";

const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync(path: string, encoding: "utf8"): string };
const css = fs.readFileSync(`${(globalThis as { process?: { cwd(): string } }).process!.cwd()}/src/styles/app.css`, "utf8");
const rule = (selector: string) => {
  const i = css.indexOf(selector);
  expect(i, selector).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf("}", i));
};

describe("narrow pages", () => {
  it("buttons and pills keep their label on one line", () => {
    expect(rule(".btn, .ghost, .danger, .pill {")).toContain("white-space: nowrap");
  });

  it("a page heading never wraps, and the header lets its actions drop to the next line", () => {
    expect(rule(".ph h1, .ph h2, .ph h3 { min-width")).toContain("white-space: nowrap");
    expect(rule(".ph { flex-wrap: wrap")).toContain("flex-wrap: wrap");
    expect(rule(".ph .sub { min-width")).toContain("text-overflow: ellipsis");
  });

  it("Today puts the week under the day once the page is tight (under 560 px)", () => {
    expect(rule(".sheet-main[data-tight] .today-cols {")).toContain("grid-template-columns: minmax(0, 1fr)");
  });

  it("the Calendar toolbar's own sub title keeps its width: the title gives way first", () => {
    expect(rule(".ph:has(.pills) .sub {")).toContain("flex: none");
  });

  it("the Tasks table drops List and Priority below 640 px and shows the list under the title; the Board scrolls sideways", () => {
    expect(rule(".sheet-main[data-table] .tr.tasks {")).toContain("var(--sp-22) minmax(0, 1fr) var(--sp-84)");
    expect(rule(".tcell .lst { display: none")).toContain("color: var(--t3)");
    expect(rule(".sheet-main[data-narrow] .board:not(.scroll) {")).toContain("overflow-x: auto");
  });

  it("Today's counts sit two by two when tight", () => {
    expect(rule(".sheet-main[data-tight] .today-stats {")).toContain("repeat(2, minmax(0, 1fr))");
  });
});
