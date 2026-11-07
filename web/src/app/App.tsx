import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Icon } from "../components/Icon";
import { Portal } from "../components/Portal";
import { useDialog } from "../components/useDialog";
import { CalendarPage } from "../features/calendar/CalendarPage";
import { ListsPage } from "../features/lists/ListsPage";
import { DeletionBanner } from "../features/auth/DeletionBanner";
import { NotificationsPage } from "../features/notifications/NotificationsPage";
import { NotificationsProvider, useNotifications } from "../features/notifications/useNotifications";
import { ProjectPage } from "../features/projects/ProjectPage";
import { ProjectsPage } from "../features/projects/ProjectsPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { CompletedPage } from "../features/completed/CompletedPage";
import { SearchDialog } from "../features/search/SearchDialog";
import { NewTaskDialog } from "../features/tasks/NewTaskDialog";
import { TaskPanel } from "../features/tasks/TaskPanel";
import { dueCount } from "../features/tasks/selectors";
import { TasksPage } from "../features/tasks/TasksPage";
import { memoryPlannerFor, plannerFor } from "../store/planners";
import { MemoryOnlyGuard } from "../features/auth/MemoryOnlyGuard";
import { StoreProvider, usePlanner } from "../store/context";
import type { PlannerStore } from "../store/types";
import { Toast } from "../components/Toast";
import { useNow } from "./clock";
import { SyncProvider } from "../sync/SyncProvider";
import { useExternalLinks } from "./links";
import { UiProvider, useUi } from "./ui";
import { AuthProvider, useAuth } from "../auth/AuthProvider";
import type { AuthServices } from "../auth/services";
import { DeviceDataOffer } from "../features/auth/DeviceDataOffer";
import { AuthGate } from "../features/auth/AuthGate";
import { PrefsProvider } from "./prefs";
import { EventPanel } from "../features/calendar/EventPanel";
import { NewEventDialog } from "../features/calendar/NewEventDialog";
import { useReminders } from "../features/reminders/useReminders";
import { useSubscriptionRefresh } from "../features/calendar/subscriptions";
import { TodayPage } from "../features/today/TodayPage";
import { initialsOf } from "./initials";
import { NAV, PHONE_MENU, SETTINGS, TABS, type NavItem } from "./nav";
import { SyncLine, useSyncStatus, withPersistence } from "../features/sync/SyncLine";
import { useSyncController, useSyncState } from "../sync/SyncProvider";
import { Link, RouterProvider, useRouter } from "./router";

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
      <aside className="side">
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
          <div className="sheet-main">{page()}</div>
          <TaskPanel />
          <EventPanel />
        </div>
      </main>
      <nav aria-label="Tabs" className="tabbar">
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
      </nav>
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
