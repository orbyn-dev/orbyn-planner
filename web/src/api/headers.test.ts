import { describe, expect, it } from "vitest";

const nodeModule = (name: string) => import(/* @vite-ignore */ name) as Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe("the deployed security headers", () => {
  it("let the page reach the engine over https and its live sync over wss, and nowhere else", async () => {
    const { spawnSync } = await nodeModule("node:child_process");
    const { mkdtempSync, writeFileSync, readFileSync } = await nodeModule("node:fs");
    const { tmpdir } = await nodeModule("node:os");
    const { join } = await nodeModule("node:path");
    const proc = (globalThis as unknown as { process: { cwd(): string; env: object } }).process;
    const dir = mkdtempSync(join(tmpdir(), "headers-"));
    writeFileSync(join(dir, "index.html"), "<html><head><script>document.documentElement.dataset.t='x'</script></head></html>");
    const run = spawnSync("node", ["scripts/headers.mjs", join(dir, "index.html"), join(dir, "out.conf")], {
      cwd: proc.cwd(),
      env: { ...proc.env, VITE_ENGINE_URL: "https://engine.example.com/" },
      encoding: "utf8",
    });
    expect(run.status).toBe(0);
    const connect = /connect-src ([^;"]*)/.exec(readFileSync(join(dir, "out.conf"), "utf8"))?.[1];
    expect(connect).toBe("'self' https://engine.example.com wss://engine.example.com");
  });
});
