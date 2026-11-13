import { afterEach, describe, expect, it } from "vitest";

import { endBoot } from "./bootSplash";

/** The page as index.html ships it: the splash is waiting (data-wait) or the app opened inside the 400 ms. */
function page(waiting: boolean): HTMLElement {
  document.body.innerHTML =
    `<div id="boot"${waiting ? ' data-wait=""' : ""}><svg class="boot-mark"></svg></div>` +
    '<div id="root" aria-busy="true"></div>';
  return document.getElementById("boot")!;
}

afterEach(() => {
  document.body.innerHTML = "";
  delete document.documentElement.dataset.booted;
});

describe("endBoot", () => {
  it("marks the page booted, clears the busy flag, and removes the splash when the fade ends", () => {
    const boot = page(true);
    endBoot();
    expect(document.documentElement.dataset.booted).toBe("");
    expect(document.getElementById("root")!.hasAttribute("aria-busy")).toBe(false);
    // Still on screen while it fades: the first real screen is underneath it.
    expect(boot.isConnected).toBe(true);
    boot.dispatchEvent(new Event("transitionend"));
    expect(boot.isConnected).toBe(false);
  });

  it("takes it away at once when the wait never began, so the mark never flashes", () => {
    const boot = page(false);
    endBoot();
    expect(boot.isConnected).toBe(false);
    expect(document.documentElement.dataset.booted).toBeUndefined();
  });

  it("does nothing on a page without a splash", () => {
    document.body.innerHTML = '<div id="root"></div>';
    expect(() => endBoot()).not.toThrow();
    expect(document.documentElement.dataset.booted).toBeUndefined();
  });
});
