import { describe, expect, it } from "vitest";

const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync(path: string, encoding: "utf8"): string };
const css = fs.readFileSync(`${(globalThis as { process?: { cwd(): string } }).process!.cwd()}/src/styles/app.css`, "utf8");

describe("the phone month sheet and the offline banner (Planner Designs v49)", () => {
  const block = css.slice(css.indexOf("The month sheet and the offline phone use the structure of Phone · Calendar week"));
  it("the sheet has rounded top corners, plain chevrons and a 38 px pitch in its grid", () => {
    expect(block).toMatch(/\.month-sheet \{ border-radius: var\(--r-22\) var\(--r-22\) 0 0; \}/);
    expect(block).toContain(".month-sheet .ms-head .ghost.icon { background: none; }");
    expect(block).toContain("height: calc(var(--sp-36) - var(--sp-2))");
  });

  it("the offline pill goes first in the header, full width", () => {
    expect(block).toContain(".ph:has(.pillx.offline) .acts { order: -1;");
    expect(block).toContain(".ph .acts .pillx.offline { width: 100%;");
  });
});
