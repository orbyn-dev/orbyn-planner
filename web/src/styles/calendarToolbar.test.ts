import { describe, expect, it } from "vitest";

const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync(path: string, encoding: "utf8"): string };
const css = fs.readFileSync(`${(globalThis as { process?: { cwd(): string } }).process!.cwd()}/src/styles/app.css`, "utf8");

describe("Calendar toolbar widths", () => {
  it("never wraps on desktop, and Calendars is icon-only at 1240 px and below", () => {
    const at = css.indexOf("The Calendar toolbar never wraps");
    const block = css.slice(at);
    expect(block).toMatch(/\.ph:has\(\.pills\) \{ flex-wrap: nowrap; \}/);
    expect(block).toMatch(/@media \(max-width: 1240px\) \{\s*\.cal-btn \.lbl \{ display: none; \}/);
  });
});
