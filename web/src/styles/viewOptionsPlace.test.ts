import { describe, expect, it } from "vitest";

const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync(path: string, encoding: "utf8"): string };
const css = fs.readFileSync(`${(globalThis as { process?: { cwd(): string } }).process!.cwd()}/src/styles/app.css`, "utf8");
const rule = (selector: string) => {
  const i = css.indexOf(`\n${selector} {`);
  expect(i, selector).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf("}", i));
};

describe("The View options popover place (Planner Designs v49 p-view-options-list, p-view-options-board)", () => {
  it("hangs from the right edge of the header buttons, 40 px under their top, not from the View options button", () => {
    expect(rule(".ph .acts")).toContain("position: relative");
    expect(rule(".vo-wrap")).toContain("position: static");
    expect(rule(".vo-wrap .view-options")).toContain("top: calc(var(--sp-30) + var(--sp-10))");
  });

  it("is 5 px of padding around 30 px rows with 9 px of text inset, 1 px apart", () => {
    expect(rule(".vo-wrap .view-options")).toContain("padding: var(--sp-5)");
    expect(rule(".view-options .vo-row")).toContain("height: var(--sp-30)");
    expect(rule(".view-options .vo-row")).toContain("padding: 0 var(--sp-9)");
    expect(rule(".view-options .vo-group, .view-options .vo-group .opt-menu")).toContain("gap: var(--sp-1)");
  });
});
