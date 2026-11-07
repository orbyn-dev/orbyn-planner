import { useEffect, useRef, type RefObject } from "react";

/**
 * A popover that belongs to a control: Escape or a click outside closes it, and focus goes back to the control that opened it, so a
 * keyboard user is where they were. `anchor` is that control (it is not "outside": a click on it is the control's own toggle).
 * Changes made in the popover apply at once, so closing never loses anything.
 */
export function usePopover(open: boolean, close: () => void, anchor: RefObject<HTMLElement | null>): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);
  const onClose = useRef(close);
  useEffect(() => {
    onClose.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || anchor.current?.contains(target)) return;
      onClose.current();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose.current();
      anchor.current?.focus(); // back to the control
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open, anchor]);
  return ref;
}
