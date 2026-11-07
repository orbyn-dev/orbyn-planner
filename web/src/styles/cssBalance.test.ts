import { describe, expect, it } from "vitest";

/**
 * A rule that loses its closing brace in a merge swallows everything after it: the rest of the file then applies only inside
 * that @media block (it once hid first run, view options and the board on a wide window). Every stylesheet must balance.
 */
const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync(path: string, encoding: "utf8"): string };
const cwd = (globalThis as { process?: { cwd(): string } }).process!.cwd();
const sheets = ["app.css", "tokens.css"].map((name) => [name, fs.readFileSync(`${cwd}/src/styles/${name}`, "utf8")] as const);

/** The stylesheet without comments and strings, whose braces are not rules. */
const rules = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');

describe("stylesheets", () => {
  it.each(sheets)("%s is read and has balanced braces, never closing one too many", (_name, css) => {
    expect(css.length).toBeGreaterThan(500);
    let depth = 0;
    for (const ch of rules(css)) {
      if (ch === "{") depth += 1;
      if (ch === "}") depth -= 1;
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(depth).toBe(0);
  });
});
