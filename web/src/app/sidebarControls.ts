export interface SidebarSnapshot {
  pinned: boolean;
  expanded: boolean;
  toggle: () => void;
}

let owner: symbol | null = null;
let snapshot: SidebarSnapshot | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function getSidebarSnapshot(): SidebarSnapshot | null {
  return snapshot;
}

export function subscribeSidebar(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Latest mounted sidebar owns the controls; an older cleanup cannot remove it. */
export function registerSidebarControls(initial: SidebarSnapshot): { update: (next: SidebarSnapshot) => void; unregister: () => void } {
  const token = Symbol("sidebar");
  owner = token;
  snapshot = initial;
  notify();
  return {
    update(next) {
      if (owner !== token) return;
      if (snapshot?.pinned === next.pinned && snapshot.expanded === next.expanded && snapshot.toggle === next.toggle) return;
      snapshot = next;
      notify();
    },
    unregister() {
      if (owner !== token) return;
      owner = null;
      snapshot = null;
      notify();
    },
  };
}
