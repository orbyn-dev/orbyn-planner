import { isDesktop } from "../lib/platform";

/**
 * On the macOS desktop shell the window has no title bar of its own: the page draws to the top edge and the traffic lights sit over
 * it (Components `window-title-row`). This marks the page for the CSS (`data-titlebar`) and adds the strip along the top edge that
 * drags the window, which also covers the single-pane screens (sign-in, setup) that have no title row of their own. Everywhere else
 * it does nothing.
 */
export function isMacShell(target: { userAgent?: string; platform?: string } = typeof navigator === "undefined" ? {} : navigator): boolean {
  return isDesktop() && /Mac/i.test(`${target.platform ?? ""} ${target.userAgent ?? ""}`);
}

export function applyTitlebar(doc: Document = document, mac: boolean = isMacShell()): void {
  if (!mac || doc.querySelector(".titlebar")) return;
  doc.documentElement.setAttribute("data-titlebar", "overlay");
  const strip = doc.createElement("div");
  strip.className = "titlebar";
  strip.setAttribute("data-tauri-drag-region", "");
  strip.setAttribute("aria-hidden", "true");
  doc.body.prepend(strip);
}
