import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

interface NavigationSnapshot {
  path: string;
  canGoBack: boolean;
  canGoForward: boolean;
}

interface Router extends NavigationSnapshot {
  navigate: (to: string) => void;
  back: () => void;
  forward: () => void;
}

const RouterContext = createContext<Router | null>(null);
const HISTORY_KEY = "__orbynPlannerNavigation";

function plainState(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function markerIn(value: unknown): { owner: string; id: string } | null {
  if (!plainState(value)) return null;
  const marker = value[HISTORY_KEY];
  return plainState(marker) && typeof marker.owner === "string" && typeof marker.id === "string"
    ? { owner: marker.owner, id: marker.id } : null;
}

/** Only this mounted router's marked, observed segment is traversable. Browser history outside it is a boundary. */
class NavigationHistory {
  private readonly owner = crypto.randomUUID();
  private entries: { id: string; url: string }[] = [];
  private index = -1;
  private pending = false;
  private active = false;
  private readonly listeners = new Set<() => void>();
  private snapshot: NavigationSnapshot;

  constructor(private readonly target: Window) {
    this.snapshot = { path: target.location.pathname, canGoBack: false, canGoForward: false };
  }

  private url(): string {
    const { pathname, search, hash } = this.target.location;
    return pathname + search + hash;
  }

  private publish(): void {
    this.snapshot = {
      path: this.target.location.pathname,
      canGoBack: !this.pending && this.index > 0,
      canGoForward: !this.pending && this.index >= 0 && this.index < this.entries.length - 1,
    };
    this.listeners.forEach((listener) => listener());
  }

  private beginSegment(): void {
    this.entries = [];
    this.index = -1;
    this.pending = false;
    const state: unknown = this.target.history.state;
    // Arrays, primitives and other owners' namespace payloads remain untouched. They are safe boundaries.
    if (state !== null && (!plainState(state) || (HISTORY_KEY in state && !markerIn(state)))) return;
    const entry = { id: crypto.randomUUID(), url: this.url() };
    try {
      this.target.history.replaceState({ ...state, [HISTORY_KEY]: { owner: this.owner, id: entry.id } }, "");
      this.entries = [entry];
      this.index = 0;
    } catch {
      // If metadata cannot be saved, ordinary navigation can still work, but traversal stays unavailable.
    }
  }

  private currentIndex(): number {
    const marker = markerIn(this.target.history.state);
    if (marker?.owner !== this.owner) return -1;
    return this.entries.findIndex((entry) => entry.id === marker.id && entry.url === this.url());
  }

  private sync(): void {
    if (this.currentIndex() === this.index && this.index >= 0) return;
    this.beginSegment();
    this.publish();
  }

  private onPop = (): void => {
    const index = this.currentIndex();
    if (index < 0) this.beginSegment();
    else { this.index = index; this.pending = false; }
    this.publish();
  };

  start = (): (() => void) => {
    this.active = true;
    this.sync();
    this.target.addEventListener("popstate", this.onPop);
    return () => {
      this.active = false;
      this.target.removeEventListener("popstate", this.onPop);
    };
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getSnapshot = (): NavigationSnapshot => this.snapshot;

  navigate = (to: string): void => {
    if (!this.active || this.pending) return;
    const url = new URL(to, this.target.location.href);
    if (!to.startsWith("/") || to.startsWith("//") || url.origin !== this.target.location.origin) {
      throw new Error("Planner navigation needs an app path");
    }
    this.sync();
    const next = url.pathname + url.search + url.hash;
    if (next === this.url()) return;
    const entry = { id: crypto.randomUUID(), url: next };
    const state: unknown = this.target.history.state;
    this.target.history.pushState({ ...(plainState(state) ? state : {}), [HISTORY_KEY]: { owner: this.owner, id: entry.id } }, "", next);
    this.entries = [...this.entries.slice(0, this.index + 1), entry];
    this.index = this.entries.length - 1;
    this.publish();
  };

  private traverse(delta: -1 | 1): void {
    if (!this.active || this.pending) return;
    this.sync();
    if (delta < 0 ? !this.snapshot.canGoBack : !this.snapshot.canGoForward) return;
    // Browser traversal is asynchronous. Lock before calling it so repeated clicks cannot escape the segment.
    this.pending = true;
    this.publish();
    try { this.target.history.go(delta); }
    catch (error) { this.pending = false; this.publish(); throw error; }
  }

  back = (): void => { this.traverse(-1); };
  forward = (): void => { this.traverse(1); };
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [history] = useState(() => new NavigationHistory(window));
  const snapshot = useSyncExternalStore(history.subscribe, history.getSnapshot);
  useEffect(() => history.start(), [history]);
  const value = useMemo(() => ({ ...snapshot, navigate: history.navigate, back: history.back, forward: history.forward }), [history, snapshot]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): Router {
  const router = useContext(RouterContext);
  if (!router) throw new Error("useRouter needs a RouterProvider");
  return router;
}

export function Link({ to, className, children, onClick, ...rest }: { to: string } & Omit<React.ComponentProps<"a">, "href">) {
  const { path, navigate } = useRouter();
  const current = path === to || (to === "/today" && path === "/") || (to !== "/today" && path.startsWith(`${to}/`));
  const classes = [className, current ? "on" : ""].filter(Boolean).join(" ");
  return (
    <a
      {...rest}
      href={to}
      className={classes}
      aria-current={current ? "page" : undefined}
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigate(to);
        onClick?.(event);
      }}
    >
      {children}
    </a>
  );
}
