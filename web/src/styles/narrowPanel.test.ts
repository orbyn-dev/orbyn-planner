import { describe, expect, it } from "vitest";

const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync(path: string, encoding: "utf8"): string };
const css = fs.readFileSync(`${(globalThis as { process?: { cwd(): string } }).process!.cwd()}/src/styles/app.css`, "utf8");
const rule = (selector: string) => {
  const i = css.indexOf(selector);
  expect(i, selector).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf("}", i));
};

describe("side panel on a narrow sheet", () => {
  it("covers the page instead of squeezing it, and takes the page out of the tab order", () => {
    expect(rule(".sheet-grid[data-overlay].has-panel {")).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(rule(".sheet-grid[data-overlay] .task-panel {")).toContain("position: absolute");
    expect(rule(".sheet-grid[data-overlay].has-panel .sheet-main {")).toContain("visibility: hidden");
  });
});
