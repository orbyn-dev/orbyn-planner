import { isDesktop } from "../lib/platform";
import { dialogBackgroundLocked } from "../ui/primitives/useDialog";

export function isWindowsShell(target: { userAgent?: string; platform?: string } = typeof navigator === "undefined" ? {} : navigator): boolean {
  return isDesktop() && /Win/i.test(`${target.platform ?? ""} ${target.userAgent ?? ""}`);
}

export type DesktopShellAction = "ready" | "fallback" | "state" | "menu" | "minimize" | "toggle_maximize" | "close" | "drag";

interface Internals {
  invoke: (command: string, args: Record<string, unknown>) => Promise<unknown>;
}

/** Only the current main window is reachable; the native side validates both the caller and the action. */
export async function invokeDesktopShell(action: DesktopShellAction): Promise<boolean> {
  const internals = (window as unknown as { __TAURI_INTERNALS__?: Internals }).__TAURI_INTERNALS__;
  if (!internals) throw new Error("Desktop window controls are unavailable");
  const maximized = await internals.invoke("desktop_shell", { action });
  if (typeof maximized !== "boolean") throw new Error("Desktop window state is unavailable");
  return maximized;
}

// The early titlebar root has no account/store providers. Only a mounted planner Shell can supply search.
let search: { open: () => void } | null = null;
const listeners = new Set<() => void>();

export function registerDesktopSearch(open: () => void): () => void {
  const registration = { open };
  search = registration;
  listeners.forEach((listener) => listener());
  return () => {
    if (search !== registration) return;
    search = null;
    listeners.forEach((listener) => listener());
  };
}

export function subscribeDesktopSearch(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const desktopSearchAvailable = (): boolean => search !== null;
export const openDesktopSearch = (): void => { if (!dialogBackgroundLocked()) search?.open(); };
