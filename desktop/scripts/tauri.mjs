// Runs `tauri dev` or `tauri build` with the engine address from config.json (or ORBYN_ENGINE_URL):
// it goes into the web build as VITE_ENGINE_URL and into the window's CSP.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { contentSecurityPolicy } from "./engine.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const command = process.argv[2];
if (command !== "dev" && command !== "build") {
  console.error("usage: node scripts/tauri.mjs dev|build [tauri options]");
  process.exit(2);
}

const config = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
const engineUrl = process.env.ORBYN_ENGINE_URL || config.engineUrl;
let csp;
try {
  // A release build is refused here if its policy would allow localhost.
  csp = contentSecurityPolicy(engineUrl, { dev: command === "dev" });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const override = JSON.stringify({ app: { security: { csp, devCsp: csp } } });

// Launch the CLI with Node directly: cmd.exe strips the quotes from the JSON override.
const bin = join(root, "node_modules", "@tauri-apps", "cli", "tauri.js");
const result = spawnSync(process.execPath, [bin, command, "--config", override, ...process.argv.slice(3)], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, VITE_ENGINE_URL: engineUrl },
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
