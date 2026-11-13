import { afterEach, describe, expect, it, vi } from "vitest";

import { endBoot } from "./bootSplash";

/** The page as index.html ships it: the splash, shown at `shownAt`, and the root still marked busy. */
function page(shownAt: number | null): HTMLElement {
  document.body.innerHTML =
    '<div id="boot"><svg class="boot-mark"></svg></div><div id="root" aria-busy="true"></div>';
  if (shownAt !== null) document.documentElement.dataset.bootShown = String(shownAt);
  return document.getElementById("boot")!;
}

afterEach(() => {
  document.body.innerHTML = "";
  delete document.documentElement.dataset.booted;
  delete document.documentElement.dataset.bootShown;
  vi.useRealTimers();
});

describe("endBoot", () => {
  it("keeps the mark up for 400 ms from the frame it showed, then fades it out over the first screen", () => {
    vi.useFakeTimers();
    const boot = page(Date.now());
    endBoot();
    expect(document.getElementById("root")!.hasAttribute("aria-busy")).toBe(false);
    // Still fully on screen: the app was ready in the same frame the window showed.
    expect(document.documentElement.dataset.booted).toBeUndefined();
    vi.advanceTimersByTime(400);
    expect(document.documentElement.dataset.booted).toBe("");
    // Still on screen while it fades: the first real screen is underneath it.
    expect(boot.isConnected).toBe(true);
    boot.dispatchEvent(new Event("transitionend"));
    expect(boot.isConnected).toBe(false);
  });

  it("takes it away at once when the mark has already been up long enough", () => {
    vi.useFakeTimers();
    const boot = page(Date.now() - 5_000);
    endBoot();
    expect(document.documentElement.dataset.booted).toBe("");
    boot.dispatchEvent(new Event("transitionend"));
    expect(boot.isConnected).toBe(false);
  });

  it("does nothing on a page without a splash", () => {
    document.body.innerHTML = '<div id="root"></div>';
    expect(() => endBoot()).not.toThrow();
    expect(document.documentElement.dataset.booted).toBeUndefined();
  });
});
