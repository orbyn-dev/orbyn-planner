import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { motionMs } from "../styles/tokens";

/** How long a toast stays: four seconds, five when it has Undo; the pointer or focus on it pauses the clock (Planner Designs v54 p-toast-states). */
export const TOAST_MS = 4_000;
export const TOAST_UNDO_MS = 5_000;
/** At most this many toasts show at once; the oldest goes when another comes. */
export const MAX_TOASTS = 3;

export interface ToastState {
  id: number;
  message: string;
  undo?: () => void;
  /** Move focus to Undo when it appears, for a change that took the focused thing away. */
  focusUndo?: boolean;
  /** After Undo, move focus to the row with this id (see lib/focus.ts). */
  focusRowOnUndo?: string;
  /** A second action beside Undo. */
  secondary?: { label: string; run: () => void };
  /** How long it stays, when not the usual four seconds (five with Undo). */
  ms?: number;
  /** What a screen reader hears when it differs from what is shown ("Moved “Title” to Blocked" for "Moved to Blocked"). */
  spoken?: string;
  /** It is on its way out: the exit animation is playing. */
  leaving?: boolean;
}

export interface ToastOptions {
  focusUndo?: boolean;
  focusRowOnUndo?: string;
  secondary?: { label: string; run: () => void };
  /** How long the toast stays, when not the usual four seconds (five with Undo). */
  ms?: number;  /** What a screen reader hears when it differs from what is shown ("Moved “Title” to Blocked" for "Moved to Blocked"). */
  spoken?: string;
}

export interface EventKey {
  id: string;
  /** The date of the occurrence that was opened. */
  date: string;
}

interface Ui {
  taskId: string | null;
  openTask: (id: string) => void;
  closeTask: () => void;
  eventKey: EventKey | null;
  openEvent: (id: string, date: string) => void;
  closeEvent: () => void;
  /** The day a new event starts on, while the New event dialog is open. */
  newEventDate: string | null;
  /** The hour a new event starts at (`HH:00`), when it was started from a time slot. */
  newEventTime: string | null;
  /** The title the New event dialog starts with, when it was opened from Search or add. */
  newEventTitle: string;
  openNewEvent: (date?: string, time?: string, title?: string) => void;
  closeNewEvent: () => void;
  listId: string | null;
  selectList: (id: string) => void;
  newTaskOpen: boolean;
  /** Where a new task starts out, when opened from a project. */
  newTaskDefaults: { projectId?: string | null; sectionId?: string | null };
  openNewTask: (defaults?: { projectId?: string | null; sectionId?: string | null }) => void;
  closeNewTask: () => void;
  /** The phone menu sheet (the round button in the Today header). */
  menuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  /** Oldest first, so the newest is at the bottom. */
  toasts: ToastState[];
  showToast: (message: string, undo?: () => void, options?: ToastOptions) => void;
  dismissToast: (id: number) => void;
}

const UiContext = createContext<Ui | null>(null);
let toastCounter = 0;

export function UiProvider({ children }: { children: ReactNode }) {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [eventKey, setEventKey] = useState<EventKey | null>(null);
  const [newEventDate, setNewEventDate] = useState<string | null>(null);
  const [newEventTime, setNewEventTime] = useState<string | null>(null);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [listId, setListId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskDefaults, setNewTaskDefaults] = useState<{ projectId?: string | null; sectionId?: string | null }>({});
  const [toasts, setToasts] = useState<ToastState[]>([]);

  const showToast = useCallback((message: string, undo?: () => void, options?: ToastOptions) => {
    const next: ToastState = { id: ++toastCounter, message, undo, focusUndo: options?.focusUndo, focusRowOnUndo: options?.focusRowOnUndo, secondary: options?.secondary, ms: options?.ms, spoken: options?.spoken };
    setToasts((all) => [...all, next].slice(-MAX_TOASTS));
  }, []);
  const dismissToast = useCallback((id: number) => {
    // It leaves in about 70 percent of the time it took to arrive, then goes.
    setToasts((all) => all.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), motionMs("fast") * 0.7);
  }, []);

  const value = useMemo<Ui>(
    () => ({
      taskId,
      // The side panel shows one thing at a time: a task or an event.
      openTask: (id: string) => {
        setEventKey(null);
        setTaskId(id);
      },
      closeTask: () => setTaskId(null),
      eventKey,
      openEvent: (id: string, date: string) => {
        setTaskId(null);
        setEventKey({ id, date });
      },
      closeEvent: () => setEventKey(null),
      newEventDate,
      newEventTime,
      newEventTitle,
      openNewEvent: (date?: string, time?: string, title?: string) => {
        setNewEventTitle(title ?? "");
        setNewEventTime(time ?? null);
        setNewEventDate(date ?? "");
      },
      closeNewEvent: () => setNewEventDate(null),
      listId,
      selectList: setListId,
      newTaskOpen,
      newTaskDefaults,
      openNewTask: (defaults) => {
        setNewTaskDefaults(defaults ?? {});
        setNewTaskOpen(true);
      },
      closeNewTask: () => setNewTaskOpen(false),
      menuOpen,
      openMenu: () => setMenuOpen(true),
      closeMenu: () => setMenuOpen(false),
      searchOpen,
      openSearch: () => setSearchOpen(true),
      closeSearch: () => setSearchOpen(false),
      toasts,
      showToast,
      dismissToast,
    }),
    [newTaskDefaults, taskId, eventKey, newEventDate, newEventTime, newEventTitle, listId, newTaskOpen, searchOpen, menuOpen, toasts, showToast, dismissToast],
  );
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): Ui {
  const ui = useContext(UiContext);
  if (!ui) throw new Error("useUi needs a UiProvider");
  return ui;
}
