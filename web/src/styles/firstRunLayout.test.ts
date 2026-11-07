import { describe, expect, it } from "vitest";

// The stylesheets as text. The web project has no Node types, so the file system comes in by a dynamic import.
const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync(path: string, encoding: "utf8"): string };
const css = fs.readFileSync(`${(globalThis as { process?: { cwd(): string } }).process!.cwd()}/src/styles/app.css`, "utf8");
const tokens = fs.readFileSync(`${(globalThis as { process?: { cwd(): string } }).process!.cwd()}/src/styles/tokens.css`, "utf8");
const at = css.indexOf("/* First run (Planner Designs");
const end = css.indexOf("/* View options as a 280 px list");
const block = css.slice(at, end);
/** One rule's declarations, as written in the first-run block. */
const rule = (selector: string) => {
  const m = new RegExp(`(?:^|\\n)${selector.replace(/[.[\]()*]/g, "\\$&")} \\{([^}]*)\\}`).exec(block);
  if (!m) throw new Error(`no rule ${selector}`);
  return m[1]!;
};
/** The same rule's declarations inside the phone media query of the block. */
const phone = css.slice(css.indexOf("@media (max-width: 767px) {", at), end);

describe("First run layout (Planner Designs first-run, fr-week, fr-calendar, fr-list, fr-phone)", () => {
  it("the block is there, and no rule of it sits inside another media query", () => {
    expect(at).toBeGreaterThan(0);
    expect(block.length).toBeGreaterThan(1500);
    // Everything before the first phone query is at the top level: a depth of 0 at the first-run rule.
    let depth = 0;
    for (const ch of css.slice(0, at)) depth += ch === "{" ? 1 : ch === "}" ? -1 : 0;
    expect(depth).toBe(0);
  });

  it("the welcome is centred: centred stack, centred step tiles 12 px apart, 640 px wide", () => {
    expect(rule(".first-run")).toMatch(/align-items: center/);
    expect(rule(".first-run")).toMatch(/text-align: center/);
    expect(rule(".first-run > *")).toMatch(/max-width: var\(--sp-640\)/);
    expect(rule(".fr-tiles")).toMatch(/list-style: none/);
    expect(rule(".fr-tiles")).toMatch(/repeat\(3, minmax\(0, 1fr\)\)/);
    expect(rule(".fr-tiles")).toMatch(/gap: var\(--sp-12\)/);
    expect(rule(".fr-tiles .stat")).toMatch(/text-align: center/);
  });

  it("a step is one left-aligned 540 px column with 14 px between its parts", () => {
    expect(rule(".fr-steps > .fr-step")).toMatch(/max-width: var\(--sp-540\)/);
    expect(rule(".fr-steps > .fr-step")).toMatch(/gap: var\(--sp-14\)/);
    expect(rule(".fr-steps > .fr-step")).toMatch(/text-align: left/);
    expect(tokens).toMatch(/--sp-540: 540px/);
  });

  it("the progress bars are 22 by 3 px, ink when reached and a rule colour after", () => {
    expect(rule(".fr-bars i")).toMatch(/width: var\(--sp-22\)/);
    expect(rule(".fr-bars i")).toMatch(/height: var\(--sp-3\)/);
    expect(rule('.fr-bars i[data-on="true"]')).toMatch(/background: var\(--t1\)/);
  });

  it("a choice is a 10 px card with a 1 px rule that turns to a 1.5 px ink ring when chosen", () => {
    expect(rule(".fr-choice")).toMatch(/padding: var\(--sp-12\) var\(--sp-14\)/);
    expect(rule(".fr-choice")).toMatch(/border-radius: var\(--r-10\)/);
    expect(rule('.fr-choice[data-selected="true"], .fr-choice[aria-checked="true"]')).toMatch(/inset 0 0 0 var\(--bw-1-5\) var\(--t1\)/);
    expect(rule(".fr-radio")).toMatch(/width: var\(--sp-15\)/);
  });

  it("the colour dots are 18 px, 10 px apart, with a ring on the chosen one", () => {
    expect(rule(".fr-colours")).toMatch(/gap: var\(--sp-10\)/);
    expect(rule(".fr-colours .colour-btn .sw")).toMatch(/width: var\(--sp-18\)/);
    expect(rule('.fr-colours .colour-btn[aria-checked="true"] .sw')).toMatch(/var\(--sp-3-5\) var\(--t1\)/);
  });

  it("on a phone Continue is full width and 44 px tall above Back and Skip for now, and the long hints go", () => {
    expect(phone).toMatch(/\.fr-step \.fr-actions \{[^}]*grid-template-areas: "go go" "back skip"/);
    expect(phone).toMatch(/\.fr-step \.fr-go \{[^}]*height: var\(--sp-44\)/);
    expect(phone).toMatch(/\.fr-more \{ display: none; \}/);
    expect(phone).toMatch(/\.first-run \{[^}]*padding: var\(--sp-8\) var\(--sp-20\) var\(--sp-24\)/);
  });
});
