import { isDesktop } from "./platform";

/**
 * On the macOS desktop shell the window has no title bar of its own: the page draws to the top edge and the traffic lights sit over
 * it, so the top of the window is the app's surface, not a grey band. This marks the page for the CSS (`data-titlebar`, which moves
 * everything down by the height of the bar) and adds the strip the window is dragged by. Everywhere else it does nothing.
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
