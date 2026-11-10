import { afterEach, describe, expect, it, vi } from "vitest";
import { getSidebarSnapshot, registerSidebarControls, subscribeSidebar } from "./sidebarControls";

const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); });

describe("the app-owned sidebar controller", () => {
  it("publishes a stable snapshot and clears it when its owner unmounts", () => {
    expect(getSidebarSnapshot()).toBeNull();
    const changed = vi.fn();
    cleanups.push(subscribeSidebar(changed));
    const toggle = vi.fn();
    const owner = registerSidebarControls({ pinned: true, expanded: true, toggle });
    cleanups.push(owner.unregister);
    expect(getSidebarSnapshot()).toEqual({ pinned: true, expanded: true, toggle });
    expect(getSidebarSnapshot()).toBe(getSidebarSnapshot());
    owner.update({ pinned: false, expanded: true, toggle });
    expect(getSidebarSnapshot()).toMatchObject({ pinned: false, expanded: true });
    getSidebarSnapshot()?.toggle();
    expect(toggle).toHaveBeenCalledOnce();
    owner.unregister();
    expect(getSidebarSnapshot()).toBeNull();
    expect(changed).toHaveBeenCalled();
  });

  it("ignores stale owner updates and teardown after a newer registration", () => {
    const old = registerSidebarControls({ pinned: false, expanded: false, toggle: vi.fn() });
    const latestToggle = vi.fn();
    const latest = registerSidebarControls({ pinned: true, expanded: true, toggle: latestToggle });
    cleanups.push(old.unregister, latest.unregister);
    old.update({ pinned: false, expanded: false, toggle: vi.fn() });
    old.unregister();
    expect(getSidebarSnapshot()).toEqual({ pinned: true, expanded: true, toggle: latestToggle });
    latest.unregister();
    old.update({ pinned: false, expanded: true, toggle: vi.fn() });
    expect(getSidebarSnapshot()).toBeNull();
  });

  it("does not notify on unchanged snapshots or after unsubscribe", () => {
    const changed = vi.fn();
    const stop = subscribeSidebar(changed);
    cleanups.push(stop);
    const snapshot = { pinned: true, expanded: true, toggle: vi.fn() };
    const owner = registerSidebarControls(snapshot);
    cleanups.push(owner.unregister);
    changed.mockClear();
    owner.update({ ...snapshot });
    expect(changed).not.toHaveBeenCalled();
    stop();
    owner.update({ ...snapshot, expanded: false });
    expect(changed).not.toHaveBeenCalled();
  });
});
