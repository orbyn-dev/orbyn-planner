import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import { createRoot } from "react-dom/client";
import { dialogBackgroundLocked, subscribeDialogBackground } from "../ui/primitives/useDialog";
import { getShellNavigation, invokeDesktopShell, isWindowsShell, runShellNavigation, subscribeShellNavigation, type DesktopMenuPosition, type DesktopShellAction } from "./desktopShell";
import { getSidebarSnapshot, subscribeSidebar } from "./sidebarControls";

/** Mounted independently of the planner so auth, isolated email routes and failed app boot retain window controls. */
export function DesktopTitlebar() {
  const navigation = useSyncExternalStore(subscribeShellNavigation, getShellNavigation);
  const sidebar = useSyncExternalStore(subscribeSidebar, getSidebarSnapshot);
  const modalOpen = useSyncExternalStore(subscribeDialogBackground, dialogBackgroundLocked);
  const [maximized, setMaximized] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);
  const request = useRef(0);

  useEffect(() => {
    let active = true;
    const update = async (action: DesktopShellAction) => {
      const current = ++request.current;
      try {
        const state = await invokeDesktopShell(action);
        if (active && current === request.current) setMaximized(state);
      } catch {
        if (active) setFailed(true);
        // Restore the native title bar if the custom controls cannot serve the window.
        await invokeDesktopShell("fallback").catch(() => { /* The frame is kept until ready succeeds. */ });
      }
    };
    void update("ready");
    const refresh = () => { void update("state"); };
    window.addEventListener("resize", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("resize", refresh);
      window.removeEventListener("focus", refresh);
      // If this independent root is ever removed, leave system controls in its place.
      void invokeDesktopShell("fallback").catch(() => { /* The native frame also resets at the start of each document. */ });
    };
  }, []);

  const run = async (action: DesktopShellAction, position?: DesktopMenuPosition) => {
    const current = ++request.current;
    try {
      const state = await invokeDesktopShell(action, position);
      if (current === request.current) setMaximized(state);
      if (action === "ready") setFailed(false);
    } catch {
      setFailed(true);
      await invokeDesktopShell("fallback").catch(() => { /* Native recovery may itself be unavailable; Alt+F4 still belongs to the OS. */ });
    }
  };
  const showMenu = async () => {
    const editor = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const anchor = menuButton.current?.getBoundingClientRect();
    const bar = header.current?.getBoundingClientRect();
    if (!anchor || !bar) return;
    setMenuOpen(true);
    await run("menu", { x: anchor.left, y: bar.bottom });
    setMenuOpen(false);
    // Native editing remains available within a modal without moving focus behind its trap.
    if (dialogBackgroundLocked() && editor?.isConnected) editor.focus();
    else menuButton.current?.focus();
  };
  const drag = (event: MouseEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || event.button !== 0) return;
    event.preventDefault();
    void run(event.detail === 2 ? "toggle_maximize" : "drag");
  };

  const appBlocked = !navigation || modalOpen;
  const toggleSidebar = () => {
    if (getShellNavigation() && !dialogBackgroundLocked()) getSidebarSnapshot()?.toggle();
  };

  return (
    <header ref={header} className="desktop-titlebar" aria-label="Window" onMouseDown={drag}>
      <div className="desktop-navigation">
        <button type="button" className="desktop-chrome" aria-label="Toggle sidebar" aria-pressed={sidebar?.pinned ?? false} aria-expanded={sidebar?.expanded ?? false} disabled={appBlocked || !sidebar} onClick={toggleSidebar}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>
        </button>
        <span className="desktop-divider" aria-hidden="true" />
        <button type="button" className="desktop-chrome" aria-label="Back" disabled={appBlocked || !navigation?.canGoBack} onClick={() => { runShellNavigation("back"); }}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
        </button>
        <button type="button" className="desktop-chrome" aria-label="Forward" disabled={appBlocked || !navigation?.canGoForward} onClick={() => { runShellNavigation("forward"); }}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg>
        </button>
        <div className="desktop-breadcrumb" aria-label="Location"><span>Workspace</span>{navigation && <><span className="desktop-slash" aria-hidden="true">/</span><strong>{navigation.destination}</strong></>}</div>
      </div>
      <button ref={menuButton} type="button" className="desktop-chrome desktop-menu" aria-label="App menu" aria-haspopup="menu" aria-expanded={menuOpen} onMouseDown={(event) => { event.preventDefault(); }} onClick={() => { void showMenu(); }}>
        <span>Menu</span><svg className="desktop-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4" /></svg>
      </button>
      <div className="desktop-caption">
        <button type="button" aria-label="Minimize window" onClick={() => { void run("minimize"); }}><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 6h10" /></svg></button>
        <button type="button" aria-label={maximized ? "Restore window" : "Maximize window"} onClick={() => { void run("toggle_maximize"); }}><svg viewBox="0 0 12 12" aria-hidden="true">{maximized ? <path d="M3 3V1h8v8H9M1 3h8v8H1Z" /> : <rect x="1.5" y="1.5" width="9" height="9" />}</svg></button>
        <button type="button" className="desktop-close" aria-label="Close window" onClick={() => { void run("close"); }}><svg viewBox="0 0 12 12" aria-hidden="true"><path d="m1.5 1.5 9 9m0-9-9 9" /></svg></button>
      </div>
      {failed && <div className="desktop-window-error" role="alert">Window controls unavailable.<button type="button" onClick={() => { void run("ready"); }}>Retry</button></div>}
    </header>
  );
}

export function mountDesktopTitlebar(doc: Document = document): void {
  if (!isWindowsShell() || doc.getElementById("desktop-titlebar-root")) return;
  const host = doc.createElement("div");
  host.id = "desktop-titlebar-root";
  doc.body.prepend(host);
  doc.documentElement.setAttribute("data-titlebar", "windows");
  createRoot(host).render(<DesktopTitlebar />);
}
