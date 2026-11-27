import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { PlannerState, PlannerStore } from "../core/planner/types";

const StoreContext = createContext<PlannerStore | null>(null);

export function StoreProvider({ store, children }: { store: PlannerStore; children: ReactNode }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): PlannerStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore needs a StoreProvider");
  return store;
}

/** The current tasks, lists and outbox; re-renders on every change. */
export function usePlanner(): PlannerState {
  return usePlannerSelector(identity);
}

const identity = (state: PlannerState) => state;

/** A snapshot reader owns this mutable cache, outside React's render state. */
function selectionReader<T>(store: PlannerStore, selector: (state: PlannerState) => T, equality: (previous: T, next: T) => boolean): () => T {
  let cached: { state: PlannerState; selection: T } | undefined;
  return () => {
    const state = store.getState();
    if (cached && Object.is(cached.state, state)) return cached.selection;
    const next = selector(state);
    const selection = cached && equality(cached.selection, next) ? cached.selection : next;
    cached = { state, selection };
    return selection;
  };
}

/** Subscribe to a snapshot slice. Equal results retain their reference, including allocated selections. */
export function usePlannerSelector<T>(selector: (state: PlannerState) => T, equality: (previous: T, next: T) => boolean = Object.is): T {
  const store = useStore();
  // Each render's selector owns its cache: a concurrent render cannot change another render's selection.
  const getSelection = useMemo(() => selectionReader(store, selector, equality), [store, selector, equality]);
  return useSyncExternalStore(store.subscribe, getSelection, getSelection);
}
