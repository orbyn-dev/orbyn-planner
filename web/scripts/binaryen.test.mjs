// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { binaryenTool } from "./binaryen.mjs";

const spawn = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ spawnSync: spawn }));
afterEach(() => { vi.unstubAllGlobals(); spawn.mockClear(); });

it("rejects a modified official archive before extraction or tool execution", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new TextEncoder().encode("modified archive").buffer })));
  const pin = { version: "133", archives: { [`${process.platform}-${process.arch}`]: { platform: "test", sha256: "0".repeat(64) } } };
  await expect(binaryenTool(pin)).rejects.toThrow("does not match its pinned SHA-256");
  expect(spawn).not.toHaveBeenCalled();
});

it("reports an unsupported platform before downloading or executing anything", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(binaryenTool({ version: "133", archives: {} })).rejects.toThrow("no pinned archive");
  expect(fetch).not.toHaveBeenCalled();
  expect(spawn).not.toHaveBeenCalled();
});
