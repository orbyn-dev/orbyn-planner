import { afterEach, describe, expect, it, vi } from "vitest";
import { getShellNavigation, invokeDesktopShell, isWindowsShell, registerShellNavigation, runShellNavigation, subscribeShellNavigation } from "./desktopShell";

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

  it("sends a menu anchor only for the menu and rejects invalid anchors before IPC", async () => {
    const invoke = vi.fn().mockResolvedValue(false);
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = { invoke };
    await expect(invokeDesktopShell("menu", { x: 640, y: 42 })).resolves.toBe(false);
    expect(invoke).toHaveBeenCalledExactlyOnceWith("desktop_shell", { action: "menu", x: 640, y: 42 });
    invoke.mockClear();
    await expect(invokeDesktopShell("menu")).rejects.toThrow();
    for (const position of [{ x: -1, y: 42 }, { x: NaN, y: 42 }, { x: 640, y: Infinity }]) {
      await expect(invokeDesktopShell("menu", position)).rejects.toThrow();
    }
    await expect(invokeDesktopShell("close", { x: 1, y: 1 })).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe("early titlebar navigation registration", () => {
  it("exposes only mounted app actions and follows current availability", () => {
    expect(getShellNavigation()).toBeNull();
    const changed = vi.fn();
    cleanup.push(subscribeShellNavigation(changed));
    const back = vi.fn();
    const forward = vi.fn();
    const initial = { destination: "Projects", canGoBack: true, canGoForward: false, back, forward };
    const owner = registerShellNavigation(initial);
    cleanup.push(owner.unregister);
    expect(getShellNavigation()).toMatchObject({ destination: "Projects" });
    expect(getShellNavigation()).toBe(getShellNavigation());
    runShellNavigation("back");
    runShellNavigation("forward");
    expect(back).toHaveBeenCalledOnce();
    expect(forward).not.toHaveBeenCalled();
    owner.update({ ...initial, destination: "Calendar", canGoBack: false, canGoForward: true });
    runShellNavigation("back");
    runShellNavigation("forward");
    expect(back).toHaveBeenCalledOnce();
    expect(forward).toHaveBeenCalledOnce();
    owner.unregister();
    expect(getShellNavigation()).toBeNull();
    runShellNavigation("forward");
    expect(forward).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenCalled();
  });

  it("stale updates and teardown cannot resurrect or remove the current owner", () => {
    const initial = { destination: "Tasks", canGoBack: true, canGoForward: false, back: vi.fn(), forward: vi.fn() };
    const old = registerShellNavigation(initial);
    const latest = registerShellNavigation({ ...initial, destination: "Projects" });
    cleanup.push(old.unregister, latest.unregister);
    old.update(initial);
    old.unregister();
    expect(getShellNavigation()?.destination).toBe("Projects");
    latest.unregister();
    old.update(initial);
    expect(getShellNavigation()).toBeNull();
  });
});
