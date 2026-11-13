/**
 * The splash in index.html (Planner Designs `p-splash`; the ask is orbyn-designs `briefs/planner-splash`).
 * It is on screen from the first frame the window shows, so the launch starts with the mark, not an empty window.
 *
 * Call this once the first real screen has painted, never when the module finishes loading: the account gate
 * renders nothing while it waits, and taking the splash away then would leave the window it exists to cover.
 */
export function endBoot(): void {
  const boot = document.getElementById("boot");
  if (!boot) return;
  document.getElementById("root")?.removeAttribute("aria-busy");
  const leave = () => {
    // Fades out over the screen that is already painted underneath.
    document.documentElement.dataset.booted = "";
    boot.addEventListener("transitionend", () => boot.remove(), { once: true });
    // A page that never composites a transition still loses the splash: the fade is the normal way out, this is the guard.
    window.setTimeout(() => boot.remove(), BOOT_GUARD_MS);
  };
  const hold = SPLASH_MS - (Date.now() - Number(document.documentElement.dataset.bootShown ?? Date.now()));
  // The app can be ready in the same frame the window shows: the mark stays a moment anyway, so a launch never flashes it.
  if (hold > 0) window.setTimeout(leave, hold);
  else leave();
}

/** How long the mark is on screen at least (Motion Designs' wait), so it is seen rather than flashed. */
const SPLASH_MS = 400;

/** Longer than the fade in boot.css (--m-fast), so the guard only fires when the transition never ran. */
const BOOT_GUARD_MS = 1000;
