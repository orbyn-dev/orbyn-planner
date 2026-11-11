import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
import { initialsOf } from "../lib/initials";
import { NAV, PHONE_MENU, SETTINGS, TABS, type NavItem } from "./nav";
import { SyncLine, useSyncStatus, withPersistence } from "../features/sync";
import { useSyncController, useSyncState } from "../state/sync";
import { Link, RouterProvider, useRouter } from "../state/router";
import { TitleRow } from "../ui/product/TitleRow";
import { SidebarRail } from "../ui/product/SidebarRail";
import { useSidebarWidth } from "../ui/product/sidebarWidth";
import { isMacShell } from "./titlebar";

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
    <Link to={item.path} className={className} onClick={onNavigate}>
      <Icon name={item.icon} />
      <span>{item.label}</span>
      {badge && <span className={amberBadge ? "n amber" : "n"}>{badge}</span>}
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
      <kbd>⌘K</kbd>
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

const SIDEBAR_KEY = "orbyn-planner.sidebar-hidden";

/** Whether the sidebar is collapsed from the title row's toggle; kept on this device. */
function useSidebarHidden(): [boolean, () => void] {
  const [hidden, setHidden] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggle = useCallback(() => {
    setHidden((was) => {
      try {
        window.localStorage.setItem(SIDEBAR_KEY, was ? "0" : "1");
      } catch {
        /* kept for this session only */
      }
      return !was;
    });
  }, []);
  return [hidden, toggle];
}

function Shell() {
  const { path, back, forward, canBack, canForward } = useRouter();
  const mac = useMemo(() => isMacShell(), []);
  const [sideHidden, toggleSide] = useSidebarHidden();
  const [sideWidth, setSideWidth] = useSidebarWidth();
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
    <div className={mac && sideHidden ? "app side-hidden" : "app"} style={{ "--side-w": `${sideWidth}px` } as CSSProperties}>
      {mac && <TitleRow sideHidden={sideHidden} onToggle={toggleSide} canBack={canBack} canForward={canForward} onBack={back} onForward={forward} />}
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
      <aside className="side">
        <SidebarRail width={sideWidth} onChange={setSideWidth} />
        <QuickFind />
        <nav aria-label="Primary" className="primary">
          {NAV.map((item) => (
            <NavLink key={item.path} item={item} badge={item.path === "/tasks" && due > 0 ? `${due} due` : item.path === "/notifications" && unread > 0 ? String(unread) : undefined} amberBadge={item.path === "/tasks"} />
          ))}
          <NavLink item={SETTINGS} className="nav bottom" />
        </nav>
      </aside>
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
