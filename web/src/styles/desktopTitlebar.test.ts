import { describe, expect, it } from "vitest";

const nodeFs = "node:fs";
const fs = await import(/* @vite-ignore */ nodeFs) as { readFileSync(path: string, encoding: "utf8"): string };
const cwd = (globalThis as { process?: { cwd(): string } }).process!.cwd();
const css = fs.readFileSync(`${cwd}/src/styles/app.css`, "utf8");

describe("the selected navigation-first D titlebar geometry", () => {
  it("groups navigation and breadcrumb on the left and Menu on the right", () => {
    expect(css).toMatch(/\.desktop-navigation \{[^}]*display: flex;[^}]*gap: var\(--sp-3\)/);
    expect(css).toMatch(/\.desktop-breadcrumb \{[^}]*gap: var\(--sp-8\);[^}]*margin-left: var\(--sp-4\)/);
    expect(css).toMatch(/\.desktop-titlebar \.desktop-menu \{[^}]*margin-left: auto;[^}]*margin-right: var\(--sp-6\)/);
    expect(css).not.toContain(".desktop-search");
  });

  it("retains D's 42px bar, compact navigation and Windows caption geometry", () => {
    expect(css).toContain(':root[data-titlebar="windows"] { --titlebar: var(--sp-42); }');
    expect(css).toMatch(/\.desktop-titlebar \.desktop-chrome \{[^}]*height: var\(--sp-28\);[^}]*min-width: var\(--sp-29\)/);
    expect(css).toMatch(/\.desktop-caption button \{[^}]*width: var\(--sp-46\)/);
  });
});
