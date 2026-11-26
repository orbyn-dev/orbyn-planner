// Official Binaryen binaries are build tools, never application dependencies. Verify the pinned archive before extraction.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function binaryenTool(pin) {
  const archive = pin.archives[`${process.platform}-${process.arch}`];
  if (!archive) throw new Error(`Binaryen ${pin.version} has no pinned archive for ${process.platform}-${process.arch}.`);
  const name = `binaryen-version_${pin.version}-${archive.platform}.tar.gz`;
  const cache = join(tmpdir(), "orbyn-binaryen");
  mkdirSync(cache, { recursive: true });
  const cached = join(cache, `${archive.sha256}.tar.gz`);
  if (!existsSync(cached) || digest(readFileSync(cached)) !== archive.sha256) {
    const response = await fetch(`https://github.com/WebAssembly/binaryen/releases/download/version_${pin.version}/${name}`, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Binaryen download failed: HTTP ${response.status}.`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (digest(bytes) !== archive.sha256) throw new Error(`Binaryen ${name} does not match its pinned SHA-256.`);
    const temporary = `${cached}.${process.pid}`;
    writeFileSync(temporary, bytes);
    renameSync(temporary, cached);
  }
  const directory = mkdtempSync(join(cache, "tool-"));
  try {
    const extraction = spawnSync("tar", ["-xzf", cached, "-C", directory], { encoding: "utf8" });
    if (extraction.status !== 0) throw new Error(`Cannot extract Binaryen: ${extraction.stderr || extraction.error?.message}`);
    const executable = join(directory, `binaryen-version_${pin.version}`, "bin", process.platform === "win32" ? "wasm-opt.exe" : "wasm-opt");
    const version = spawnSync(executable, ["--version"], { encoding: "utf8" });
    if (version.status !== 0 || version.stdout.trim() !== `wasm-opt version ${pin.version} (version_${pin.version})`) throw new Error(`Unexpected wasm-opt version: ${version.stdout || version.error?.message}`);
    return { executable, dispose: () => rmSync(directory, { recursive: true, force: true }) };
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}
