import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "../ui/primitives/Icon";
import { Portal } from "../ui/primitives/Portal";
import { useDialog } from "../ui/primitives/useDialog";
import { CalendarPage, EventPanel, NewEventDialog } from "../features/calendar";
import { ListsPage } from "../features/lists";
import { AuthGate, DeletionBanner, DeviceDataOffer, MemoryOnlyGuard } from "../features/account";
import { NotificationsPage } from "../features/notifications";
import { NotificationsProvider, useNotifications } from "../state/notifications";
import { ProjectPage, ProjectsPage } from "../features/projects";
import { SettingsPage } from "../features/settings";
import { CompletedPage, dueCount, NewTaskDialog, TaskPanel, TasksPage } from "../features/tasks";
import { FirstRun, useFirstRun } from "../features/firstRun";
import { SearchDialog } from "../features/search";
import { memoryPlannerFor, plannerFor } from "../data/local/planners";
import { StoreProvider, usePlanner } from "../state/store";
import type { PlannerStore } from "../core/planner/types";
import { Toast } from "../ui/primitives/Toast";
import { useNow } from "../state/clock";
import { SyncProvider } from "../state/sync";
import { useExternalLinks } from "../lib/links";
import { UiProvider, useUi } from "../ui/product/UiProvider";
import { AuthProvider, useAuth } from "../state/account";
import type { AuthServices } from "../state/services/auth";
import { PrefsProvider } from "../state/prefs";
import { useReminders } from "../state/reminders";
import { useSubscriptionRefresh } from "../state/subscriptions";
import { TodayPage } from "../features/today";
import { PHONE_MAX_PX } from "../styles/tokens";
import { browserStorage } from "../lib/browserStorage";
import { initialsOf } from "../lib/initials";
import { NAV, PHONE_MENU, SETTINGS, TABS, type NavItem } from "./nav";
import { SyncLine, useSyncStatus, withPersistence } from "../features/sync";
import { useSyncController, useSyncState } from "../state/sync";
import { Link, RouterProvider, useRouter } from "../state/router";

const PAGES: Record<string, () => ReactNode> = {
  "/today": () => <TodayPage />,
  "/tasks": () => <TasksPage />,
  "/calendar": () => <CalendarPage />,
  "/lists": () => <ListsPage />,
  "/projects": () => <ProjectsPage />,
  "/notifications": () => <NotificationsPage />,
  "/settings": () => <SettingsPage />,
  "/completed": () => <CompletedPage />,
};

function NavLink({ item, className = "nav", onNavigate, badge, amberBadge = false }: { item: NavItem; className?: string; onNavigate?: () => void; badge?: string; amberBadge?: boolean }) {
  return (
    <Link to={item.path} className={className} onClick={onNavigate} data-badge={badge ? "true" : undefined} aria-label={badge ? `${item.label}, ${badge}${item.path === "/notifications" ? " unread" : ""}` : item.label}>
      <Icon name={item.icon} />
      <span className="side-label">{item.label}</span>
      {badge && <span className={amberBadge ? "n amber side-label" : "n side-label"}>{badge}</span>}
    </Link>
  );
}

/** The sidebar's search-or-add field: opens the dialog, also from Ctrl+K or Cmd+K. */
function QuickFind() {
  const ui = useUi();
  const { searchOpen, openSearch, closeSearch } = ui;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (searchOpen) closeSearch();
        else openSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen, openSearch, closeSearch]);
  return (
    <button type="button" className="search" onClick={openSearch} aria-keyshortcuts="Control+K Meta+K" aria-label="Search or add">
      <Icon name="search" small />
      <span>Search or add</span>
      <kbd>{typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(`${navigator.platform} ${navigator.userAgent}`) ? "⌘K" : "Ctrl+K"}</kbd>
    </button>
  );
}

/** The phone menu (p-phone-menu): Notifications with its unread count, Projects and Settings, then who is signed in and the sync state. */
function PhoneMenu({ onClose, unread }: { onClose: () => void; unread: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, onClose);
  const auth = useAuth();
  const session = auth?.session ?? null;
  const { outbox, persistence } = usePlanner();
  const sync = useSyncState();
  const controller = useSyncController();
  const syncNow = useCallback(() => controller?.syncNow(), [controller]);
  const { status, retry } = useSyncStatus(outbox.length, sync, syncNow);
  return (
    <Portal>
      <button type="button" className="more-backdrop" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <div ref={ref} className="more-sheet" role="dialog" aria-modal="true" aria-label="Menu" tabIndex={-1}>
        <span className="grab" aria-hidden="true" />
        {PHONE_MENU.map((item) => (
          <NavLink key={item.path} item={item} onNavigate={onClose} badge={item.path === "/notifications" && unread > 0 ? String(unread) : undefined} />
        ))}
        {auth && !session && (
          <>
            <hr className="msep" />
            <div className="menu-account">
              <span className="avatar" aria-hidden="true">{initialsOf(undefined, undefined)}</span>
              <span className="what">This device only</span>
              <button type="button" className="link-btn" onClick={() => { onClose(); auth.openAuth("signin"); }}>Sign in</button>
            </div>
          </>
        )}
        {session && (
          <>
            <hr className="msep" />
            <div className="menu-account">
              <span className="avatar" aria-hidden="true">{initialsOf(session.name, session.email)}</span>
              <span className="what">{session.name || session.email}</span>
              <SyncLine status={withPersistence(status, persistence)} onRetry={retry} />
            </div>
          </>
        )}
      </div>
    </Portal>
  );
}

const SIDEBAR_KEY = "orbyn-planner.sidebar";

function readSidebarPinned(): boolean {
  try { return browserStorage.get(SIDEBAR_KEY) !== "collapsed"; }
  catch { return true; }
}

function Sidebar({ due, unread }: { due: number; unread: number }) {
  const [pinned, setPinned] = useState(readSidebarPinned);
  const [peek, setPeek] = useState(false);
  const [phone, setPhone] = useState(() => typeof matchMedia === "function" && matchMedia(`(max-width: ${PHONE_MAX_PX}px)`).matches);
  const sidebar = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const pointer = useRef(false);
  const suppressed = useRef(false);

  const refresh = useCallback(() => {
    const focused = sidebar.current?.contains(document.activeElement) ?? false;
    if (!pointer.current && !focused) suppressed.current = false;
    setPeek(!suppressed.current && (pointer.current || focused));
  }, []);

  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const query = matchMedia(`(max-width: ${PHONE_MAX_PX}px)`);
    const onChange = () => {
      setPhone(query.matches);
      pointer.current = false;
      suppressed.current = sidebar.current?.contains(document.activeElement) ?? false;
      setPeek(false);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (pinned || !peek) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      suppressed.current = true;
      setPeek(false);
      toggle.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pinned, peek]);

  const changePinned = () => {
    const next = !pinned;
    setPinned(next);
    suppressed.current = true;
    setPeek(false);
    try { browserStorage.set(SIDEBAR_KEY, next ? "expanded" : "collapsed"); } catch { /* Preference remains in memory. */ }
  };

  return (
    <aside ref={sidebar} className="side" data-pinned={pinned} data-expanded={pinned || peek}
      onPointerEnter={(event) => { if (event.pointerType !== "touch") { pointer.current = true; refresh(); } }}
      onPointerLeave={() => { pointer.current = false; refresh(); }}
      onFocus={refresh}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { if (!pointer.current) suppressed.current = false; setPeek(!suppressed.current && pointer.current); } }}>
      {!phone && <button ref={toggle} type="button" className="side-toggle" aria-label={pinned ? "Collapse sidebar" : "Pin sidebar open"}
        aria-controls="primary-navigation" aria-expanded={pinned || peek} aria-pressed={pinned} onClick={changePinned}>
        <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>
        <span className="side-label">{pinned ? "Collapse sidebar" : "Pin sidebar open"}</span>
      </button>}
      <QuickFind />
      <nav id="primary-navigation" aria-label="Primary" className="primary">
        {NAV.map((item) => (
          <NavLink key={item.path} item={item} badge={item.path === "/tasks" && due > 0 ? `${due} due` : item.path === "/notifications" && unread > 0 ? String(unread) : undefined} amberBadge={item.path === "/tasks"} />
        ))}
        <NavLink item={SETTINGS} className="nav bottom" />
      </nav>
    </aside>
  );
}

function Shell() {
  const { path } = useRouter();
  const main = useRef<HTMLElement>(null);
  const ui = useUi();
  const { tasks } = usePlanner();
  const now = useNow();
  const due = dueCount(tasks, now);
  const unread = useNotifications().unread;
  useSubscriptionRefresh();
  useReminders((message) => ui.showToast(message));
  const project = /^\/projects\/([^/]+)$/.exec(path);
  const firstRun = useFirstRun();
  /** First run is the whole screen on a phone: no tab bar under it (Planner Designs fr-phone). */
  const showFirstRun = firstRun.active && (path === "/" || path === "/today");
  const page = project ? () => <ProjectPage id={decodeURIComponent(project[1]!)} /> : (PAGES[path === "/" ? "/today" : path] ?? PAGES["/today"]!);

  return (
    <div className="app">
      <a
        className="skip"
        href="#content"
        onClick={(event) => {
          event.preventDefault();
          main.current?.focus();
        }}
      >
        Skip to content
      </a>
      <Sidebar due={due} unread={unread} />
      <main id="content" ref={main} tabIndex={-1} className="sheet">
        <DeletionBanner />
        <div className={ui.taskId || ui.eventKey ? "sheet-grid has-panel" : "sheet-grid"}>
          <div className="sheet-main">{showFirstRun ? <FirstRun onDone={firstRun.finish} /> : page()}</div>
          <TaskPanel />
          <EventPanel />
        </div>
      </main>
      {!showFirstRun && <nav aria-label="Tabs" className="tabbar">
        {TABS.map((item) =>
          item.path === "/search" ? (
            <button key={item.path} type="button" className="tab" onClick={ui.openSearch}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ) : (
            <NavLink key={item.path} item={item} className="tab" />
          ),
        )}
      </nav>}
      {ui.menuOpen && <PhoneMenu onClose={ui.closeMenu} unread={unread} />}
      {ui.newTaskOpen && <NewTaskDialog />}
      {ui.newEventDate !== null && <NewEventDialog />}
      {ui.searchOpen && <SearchDialog />}
      <Toast />
    </div>
  );
}

/** `auth` turns accounts on: signed out, the public pages show first. Without it the planner runs on this device alone. */
export function App({ store, auth }: { store?: PlannerStore; auth?: AuthServices }) {
  useExternalLinks();
  return (
    <UiProvider>
      <PrefsProvider>
        <AuthProvider services={auth ?? null}>
          <PlannerStores fixed={store}>
            <AuthGate>
              <SyncProvider>
                <RouterProvider>
                  <NotificationsProvider>
                    <Shell />
                  </NotificationsProvider>
                </RouterProvider>
              </SyncProvider>
            </AuthGate>
          </PlannerStores>
        </AuthProvider>
      </PrefsProvider>
    </UiProvider>
  );
}

/**
 * Whose planner is open: the account's own while a trusted device is signed in to it, otherwise the one kept
 * on this device alone. Each is its own database, so one account never sees another's records or outbox, and
 * the planner is built again (nothing carried over) when the account changes. A store passed in (tests) is used as is.
 */
function PlannerStores({ fixed, children }: { fixed?: PlannerStore; children: ReactNode }) {
  const auth = useAuth();
  const accountId = auth?.status === "signedIn" && auth.session ? auth.session.accountId : null;
  const memoryOnly = auth?.keysInMemory === true && accountId !== null;
  const store = useMemo(() => fixed ?? (memoryOnly && accountId ? memoryPlannerFor(accountId) : plannerFor(accountId)), [fixed, accountId, memoryOnly]);
  return (
    <StoreProvider key={fixed ? "fixed" : memoryOnly ? `memory-${accountId}` : (accountId ?? "device")} store={store}>
      {!fixed && accountId && !memoryOnly && <DeviceDataOffer accountId={accountId} />}
      {memoryOnly && <MemoryOnlyGuard />}
      {children}
    </StoreProvider>
  );
}
