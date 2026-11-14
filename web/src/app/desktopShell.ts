import { isDesktop } from "../lib/platform";
import { dialogBackgroundLocked } from "../ui/primitives/useDialog";

export function isWindowsShell(target: { userAgent?: string; platform?: string } = typeof navigator === "undefined" ? {} : navigator): boolean {
  return isDesktop() && /Win/i.test(`${target.platform ?? ""} ${target.userAgent ?? ""}`);
}

export type DesktopShellAction = "ready" | "fallback" | "state" | "menu" | "minimize" | "toggle_maximize" | "close" | "drag";

interface Internals {
  invoke: (command: string, args: Record<string, unknown>) => Promise<unknown>;
}

export interface DesktopMenuPosition { x: number; y: number }

/** Only the current main window is reachable; the native side validates the caller, action and menu coordinates. */
export async function invokeDesktopShell(action: DesktopShellAction, position?: DesktopMenuPosition): Promise<boolean> {
  if (action === "menu" && (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y) || position.x < 0 || position.y < 0)) {
    throw new Error("A menu position is required");
  }
  if (action !== "menu" && position) throw new Error("Only the menu accepts a position");
  const internals = (window as unknown as { __TAURI_INTERNALS__?: Internals }).__TAURI_INTERNALS__;
  if (!internals) throw new Error("Desktop window controls are unavailable");
  const maximized = await internals.invoke("desktop_shell", { action, ...(position ?? {}) });
  if (typeof maximized !== "boolean") throw new Error("Desktop window state is unavailable");
  return maximized;
}

export interface ShellNavigationSnapshot {
  destination: string;
  canGoBack: boolean;
  canGoForward: boolean;
  back: () => void;
  forward: () => void;
}

// The early titlebar has no account/store/router providers. Only a mounted Shell can publish app actions.
let owner: symbol | null = null;
let navigation: ShellNavigationSnapshot | null = null;
const listeners = new Set<() => void>();
const notify = () => { listeners.forEach((listener) => listener()); };

export function registerShellNavigation(initial: ShellNavigationSnapshot): { update: (next: ShellNavigationSnapshot) => void; unregister: () => void } {
  const token = Symbol("shell navigation");
  owner = token;
  navigation = initial;
  notify();
  return {
    update(next) {
      if (owner !== token) return;
      if (navigation?.destination === next.destination && navigation.canGoBack === next.canGoBack && navigation.canGoForward === next.canGoForward && navigation.back === next.back && navigation.forward === next.forward) return;
      navigation = next;
      notify();
    },
    unregister() {
      if (owner !== token) return;
      owner = null;
      navigation = null;
      notify();
    },
  };
}

export function subscribeShellNavigation(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const getShellNavigation = (): ShellNavigationSnapshot | null => navigation;
export function runShellNavigation(action: "back" | "forward"): void {
  if (dialogBackgroundLocked() || !navigation) return;
  if (action === "back" && navigation.canGoBack) navigation.back();
  if (action === "forward" && navigation.canGoForward) navigation.forward();
}
