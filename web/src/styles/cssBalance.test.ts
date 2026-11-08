import { describe, expect, it } from "vitest";

/**
 * A rule that loses its closing brace in a merge swallows everything after it: the rest of the file then applies only inside
 * that @media block (it once hid first run, view options and the board on a wide window). Every stylesheet must balance, and a
 * failure names the file and the line of the block that is never closed (or of the stray closing brace).
 */
const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync(path: string, encoding: "utf8"): string };
const cwd = (globalThis as { process?: { cwd(): string } }).process!.cwd();

/** Comments and strings blanked out, with every newline kept so line numbers stay true. */
const rules = (css: string) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, (m) => '"' + " ".repeat(Math.max(0, m.length - 2)) + '"');

/** The first problem as "file:line: what", or null when every brace pairs up. */
export function braceProblem(name: string, css: string): string | null {
  const open: { line: number; head: string }[] = [];
  let line = 1;
  let head = "";
  for (const ch of rules(css)) {
    if (ch === "\n") line += 1;
    if (ch === "{") {
      open.push({ line, head: head.trim().replace(/\s+/g, " ").slice(0, 60) });
      head = "";
    } else if (ch === "}") {
      if (open.length === 0) return `${name}:${line}: a } closes nothing`;
      open.pop();
      head = "";
    } else if (ch === ";") head = "";
    else head += ch;
  }
  const last = open[0];
  return last ? `${name}:${last.line}: "${last.head}" is never closed, so everything after it sits inside it` : null;
}

describe("braceProblem", () => {
  it("names the line of an @media block that is never closed", () => {
    const css = ".a { color: red; }\n@media (max-width: 1240px) {\n  .b { color: blue; }\n.c { color: green; }\n";
    expect(braceProblem("app.css", css)).toBe('app.css:2: "@media (max-width: 1240px)" is never closed, so everything after it sits inside it');
  });
  it("names the line of a stray closing brace", () => {
    expect(braceProblem("tokens.css", ".a { color: red; }\n}\n")).toBe("tokens.css:2: a } closes nothing");
  });
  it("ignores braces in comments and strings", () => {
    expect(braceProblem("x.css", '/* { */ .a::after { content: "}"; }\n')).toBeNull();
  });
});

describe("stylesheets", () => {
  it.each(["app.css", "tokens.css"])("%s is read and every brace pairs up", (name) => {
    const css = fs.readFileSync(`${cwd}/src/styles/${name}`, "utf8");
    expect(css.length).toBeGreaterThan(500);
    expect(braceProblem(`src/styles/${name}`, css)).toBeNull();
  });
});
