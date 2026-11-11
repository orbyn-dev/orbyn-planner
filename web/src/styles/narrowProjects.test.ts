import { describe, expect, it } from "vitest";

const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync(path: string, encoding: "utf8"): string };
const css = fs.readFileSync(`${(globalThis as { process?: { cwd(): string } }).process!.cwd()}/src/styles/app.css`, "utf8");
const rule = (selector: string) => {
  const i = css.indexOf(selector);
  expect(i, selector).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf("}", i));
};

describe("narrow Projects", () => {
  it("the Projects table drops its Next column so a project name stays on one line", () => {
    expect(rule(".sheet-main[data-narrow] .tr.projects {")).toContain("minmax(0, 1fr) var(--sp-110) var(--sp-120)");
    expect(rule(".sheet-main[data-narrow] .tr.projects > :nth-child(2)")).toContain("display: none");
  });

  it("tag chips wait for room in a tight row", () => {
    expect(rule(".sheet-main[data-tight] .ttwrap .tagchips {")).toContain("display: none");
  });
});
