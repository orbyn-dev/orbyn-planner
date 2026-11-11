import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface Router {
  path: string;
  navigate: (to: string) => void;
  /** Back and forward through the screens opened in this window, like browser history. */
  back: () => void;
  forward: () => void;
  canBack: boolean;
  canForward: boolean;
}

/** Where this window is in its history (`index`) and the furthest entry it has seen (`top`); each entry we push remembers its index. */
function historyIndex(): number {
  const state = window.history.state as { i?: unknown } | null;
  return typeof state?.i === "number" ? state.i : 0;
}

const RouterContext = createContext<Router | null>(null);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(() => window.location.pathname);
  const [position, setPosition] = useState(() => ({ index: historyIndex(), top: historyIndex() }));

  useEffect(() => {
    // The first entry gets index 0, so Back is known to have nothing before it.
    if (window.history.state === null) window.history.replaceState({ i: 0 }, "", window.location.href);
    const onPop = () => {
      setPath(window.location.pathname);
      setPosition((p) => ({ ...p, index: historyIndex() }));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to: string) => {
    if (to !== window.location.pathname) {
      const next = historyIndex() + 1;
      window.history.pushState({ i: next }, "", to);
      setPosition({ index: next, top: next });
    }
    setPath(to);
  }, []);
  const back = useCallback(() => window.history.back(), []);
  const forward = useCallback(() => window.history.forward(), []);

  const value = useMemo(
    () => ({ path, navigate, back, forward, canBack: position.index > 0, canForward: position.index < position.top }),
    [path, navigate, back, forward, position],
  );
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
