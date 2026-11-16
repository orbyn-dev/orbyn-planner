import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

// Exercise the actual installed CLI: a shell can corrupt the JSON before Tauri parses it.
for (const command of ["dev", "build"]) {
  test(`${command} forwards its CSP JSON intact to Tauri`, () => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("./tauri.mjs", import.meta.url)), command, "--help"], {
      env: { ...process.env, ORBYN_ENGINE_URL: "https://engine.example.invalid" },
      encoding: "utf8",
      timeout: 30_000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /--config/);
  });
}
