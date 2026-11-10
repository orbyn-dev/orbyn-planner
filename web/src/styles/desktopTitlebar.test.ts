import { describe, expect, it } from "vitest";

const nodeFs = "node:fs";
const fs = await import(/* @vite-ignore */ nodeFs) as { readFileSync(path: string, encoding: "utf8"): string };
const cwd = (globalThis as { process?: { cwd(): string } }).process!.cwd();
const css = fs.readFileSync(`${cwd}/src/styles/app.css`, "utf8");

describe("the selected option C titlebar geometry", () => {
  it("centres the actual search field rather than an app-title label", () => {
    const search = /\.desktop-titlebar \.desktop-search \{([^}]+)\}/.exec(css)?.[1] ?? "";
    expect(search).toContain("left: 50%");
    expect(search).toContain("translateX(-50%)");
    expect(search).toContain("width: var(--sp-230)");
    expect(search).toContain("height: var(--sp-28)");
    expect(search).toContain("border-radius: var(--r-5)");
  });

  it("retains the original mock's 42px header and responsive 350px search", () => {
    expect(css).toContain(':root[data-titlebar="windows"] { --titlebar: var(--sp-42); }');
    expect(css).toMatch(/@media \(min-width: 850px\)\s*\{\s*\.desktop-titlebar \.desktop-search\s*\{\s*width: var\(--sp-350\)/);
  });
});
