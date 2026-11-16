import { describe, expect, it } from "vitest";

const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync(path: string, encoding: "utf8"): string };
const here = `${(globalThis as { process?: { cwd(): string } }).process!.cwd()}/src/styles`;
const app = fs.readFileSync(`${here}/app.css`, "utf8");
const tokens = fs.readFileSync(`${here}/tokens.css`, "utf8");

describe("native dropdown options", () => {
  it("pairs the popup surface with its ink instead of relying on the native popup background", () => {
    // WebView2 can paint a light popup despite color-scheme: dark. Inherited
    // light ink without an explicit option surface then becomes unreadable.
    const rule = /(?:^|\n)option\s*\{([^}]+)\}/.exec(app)?.[1] ?? "";
    expect(rule).toMatch(/background(?:-color)?:\s*var\(--main\)/);
    expect(rule).toMatch(/(?:^|;)\s*color:\s*var\(--t1\)/);
  });

  it.each(["light", "dark", "dim"])("keeps the %s surface opaque and the native picker color scheme explicit", (theme) => {
    const start = tokens.indexOf(`:root[data-theme="${theme}"]`);
    expect(start).toBeGreaterThan(-1);
    const block = tokens.slice(start, tokens.indexOf("}", start));
    expect(block).toMatch(/--main:\s*#[\da-f]+;/i);
    expect(block).toMatch(/--t1:\s*rgba\([^)]+\);/);
    expect(block).toContain(`color-scheme: ${theme === "light" ? "light" : "dark"};`);
  });
});
