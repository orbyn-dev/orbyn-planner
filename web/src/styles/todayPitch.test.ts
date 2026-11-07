import { describe, expect, it } from "vitest";

const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync(path: string, encoding: "utf8"): string };
const css = fs.readFileSync(`${(globalThis as { process?: { cwd(): string } }).process!.cwd()}/src/styles/app.css`, "utf8");
const rule = (selector: string) => {
  const i = css.indexOf(selector);
  expect(i, selector).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf("}", i));
};

describe("Today pitch (Planner Designs v49)", () => {
  it("a Today row is 38 px and a week list row 26 px, and the lists add the 2 px gap, so the rows are 40 px and 28 px apart", () => {
    expect(rule(".row {")).toContain("min-height: var(--sp-38)");
    expect(rule(".kv.wk")).toContain("height: var(--sp-26)");
    expect(rule(".blk {")).toContain("gap: var(--sp-2)");
    const lists = rule(".blk ul");
    expect(lists).toContain("display: flex");
    expect(lists).toContain("gap: var(--sp-2)");
  });
});
