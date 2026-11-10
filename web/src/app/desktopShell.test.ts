import { afterEach, describe, expect, it, vi } from "vitest";
import { desktopSearchAvailable, invokeDesktopShell, isWindowsShell, openDesktopSearch, registerDesktopSearch, subscribeDesktopSearch } from "./desktopShell";

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const release of cleanup.splice(0).reverse()) release();
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

describe("Windows shell boundary", () => {
  it("requires both a desktop bridge and Windows OS identity", () => {
    expect(isWindowsShell({ platform: "Win32" })).toBe(false);
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    expect(isWindowsShell({ platform: "Win32" })).toBe(true);
    expect(isWindowsShell({ platform: "MacIntel", userAgent: "Mac OS X" })).toBe(false);
    expect(isWindowsShell({ platform: "Linux x86_64" })).toBe(false);
  });

  it("invokes only the narrow command and treats false as valid restored state", async () => {
    const invoke = vi.fn().mockResolvedValue(false);
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = { invoke };
    await expect(invokeDesktopShell("toggle_maximize")).resolves.toBe(false);
    expect(invoke).toHaveBeenCalledExactlyOnceWith("desktop_shell", { action: "toggle_maximize" });
  });

  it("rejects unavailable, failed and malformed native replies", async () => {
    await expect(invokeDesktopShell("ready")).rejects.toThrow(/unavailable/);
    const invoke = vi.fn().mockRejectedValue(new Error("native failure"));
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = { invoke };
    await expect(invokeDesktopShell("ready")).rejects.toThrow("native failure");
    invoke.mockResolvedValue("false");
    await expect(invokeDesktopShell("state")).rejects.toThrow(/state is unavailable/);
  });
});

describe("early titlebar search registration", () => {
  it("stays unavailable until a planner registers and notifies on cleanup", () => {
    expect(desktopSearchAvailable()).toBe(false);
    const changed = vi.fn();
    cleanup.push(subscribeDesktopSearch(changed));
    const open = vi.fn();
    const release = registerDesktopSearch(open);
    cleanup.push(release);
    expect(desktopSearchAvailable()).toBe(true);
    openDesktopSearch();
    expect(open).toHaveBeenCalledOnce();
    release();
    expect(desktopSearchAvailable()).toBe(false);
    openDesktopSearch();
    expect(open).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it("a stale cleanup cannot remove a newer registration, even for the same callback", () => {
    const open = vi.fn();
    const old = registerDesktopSearch(open);
    const current = registerDesktopSearch(open);
    cleanup.push(old, current);
    old();
    expect(desktopSearchAvailable()).toBe(true);
    openDesktopSearch();
    expect(open).toHaveBeenCalledOnce();
    current();
    expect(desktopSearchAvailable()).toBe(false);
  });
});
