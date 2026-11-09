import { useCallback, useEffect, useRef, useState } from "react";
import { TOAST_MS, TOAST_UNDO_MS, useUi, type ToastState } from "../product/UiProvider";
import { focusRow } from "../../lib/focus";
import { Icon } from "./Icon";

/**
 * The one toast of the app (Planner Designs v54 p-toast-states, p-toast-phone): a card that follows the theme, with an icon, the text and an
 * Undo ghost button. It stays four seconds, five with Undo, and the pointer or focus on it pauses the clock. An error never toasts: errors
 * stay in a banner beside what failed.
 */
function ToastBody({ toast, dismissToast }: { toast: ToastState; dismissToast: (id: number) => void }) {
  // Stable, so a render elsewhere never restarts the clock.
  const dismiss = useCallback(() => dismissToast(toast.id), [dismissToast, toast.id]);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const undo = useRef<HTMLButtonElement>(null);
  const paused = hovered || focused;

  useEffect(() => {
    if (paused || toast.leaving) return;
    const timer = setTimeout(dismiss, toast.ms ?? (toast.undo ? TOAST_UNDO_MS : TOAST_MS));
    return () => clearTimeout(timer);
  }, [paused, dismiss, toast.ms, toast.undo, toast.leaving]);

  useEffect(() => {
    if (toast.focusUndo) undo.current?.focus();
  }, [toast.focusUndo]);

  return (
    <div
      className="toast"
      data-leaving={toast.leaving ? "true" : undefined}
      aria-hidden={toast.leaving ? true : undefined}
      inert={toast.leaving ? true : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <Icon name="check" small />
      {toast.spoken ? (
        <>
          <span aria-hidden="true" className="toast-text">{toast.message}</span>
          <span className="sr-only">{toast.spoken}</span>
        </>
      ) : (
        <span className="toast-text">{toast.message}</span>
      )}
      {toast.undo && (
        <button
          ref={undo}
          type="button"
          className="ghost sm toast-action"
          onClick={() => {
            toast.undo?.();
            dismiss();
            if (toast.focusRowOnUndo) focusRow(toast.focusRowOnUndo);
          }}
        >
          Undo
        </button>
      )}
      {toast.secondary && (
        <button
          type="button"
          className="ghost sm toast-action"
          onClick={() => {
            toast.secondary?.run();
            dismiss();
          }}
        >
          {toast.secondary.label}
        </button>
      )}
    </div>
  );
}

/** The live region stays mounted, so a screen reader hears each new message as it appears. Escape dismisses the newest toast. */
export function Toast() {
  const { toasts, dismissToast } = useUi();
  const newest = toasts.filter((t) => !t.leaving).at(-1);
  useEffect(() => {
    if (!newest) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) dismissToast(newest.id);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [newest, dismissToast]);
  return (
    <div role="status" aria-live="polite" className="toast-live">
      {toasts.map((t) => (
        <ToastBody key={t.id} toast={t} dismissToast={dismissToast} />
      ))}
    </div>
  );
}
