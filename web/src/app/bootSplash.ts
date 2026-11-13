/**
 * The splash in index.html (Planner Designs `p-splash`; the ask is orbyn-designs `briefs/planner-splash`).
 * It paints before the bundle runs, so the window is never a blank rectangle while the account loads.
 *
 * Call this once the first real screen has painted, never when the module finishes loading: the account gate
 * renders nothing while it waits, and taking the splash away then would leave the blank window it exists to
 * cover.
 */
export function endBoot(): void {
  const boot = document.getElementById("boot");
  if (!boot) return;
  document.getElementById("root")?.removeAttribute("aria-busy");
  // It never began its wait (the app opened inside the 400 ms): take it away without a flash of the mark.
  if (!boot.hasAttribute("data-wait")) {
    boot.remove();
    return;
  }
  // Fades out from whatever opacity it reached, over the screen that is already painted underneath.
  document.documentElement.dataset.booted = "";
  boot.addEventListener("transitionend", () => boot.remove(), { once: true });
  // A page that never composites a transition still loses the splash: the fade is the normal way out, this is the guard.
  window.setTimeout(() => boot.remove(), BOOT_GUARD_MS);
}

/** Longer than the fade in boot.css (--m-fast), so the guard only fires when the transition never ran. */
const BOOT_GUARD_MS = 1000;
