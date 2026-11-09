import { useEffect, useRef, type ReactNode } from "react";

export interface MenuOption<T> {
  value: T;
  label: string;
  /** A colour token (`c1`…) drawn as a dot before the label. */
  dot?: string;
}

/**
 * A short list of choices in a popover, one marked as selected. Focus starts on the selected one; the arrow keys move, Enter or a click
 * picks (Planner Designs p-row-priority, p-row-repeat, p-row-reminder, p-row-list, p-row-calendar).
 */
export function OptionMenu<T>({ label, options, selected, onPick, extra, focusOnMount = true }: { label: string; options: readonly MenuOption<T>[]; selected: T | undefined; onPick: (value: T) => void; extra?: ReactNode; focusOnMount?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusOnMount) return;
    const items = ref.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]");
    const chosen = ref.current?.querySelector<HTMLButtonElement>("[aria-checked=true]");
    (chosen ?? items?.[0])?.focus();
  }, [focusOnMount]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]") ?? [])];
    if (items.length === 0) return;
    e.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : e.key === "ArrowDown" ? (at + 1) % items.length : (at - 1 + items.length) % items.length;
    items[next]!.focus();
  };
  return (
    <div ref={ref} className="opt-menu" role="menu" aria-label={label} onKeyDown={onKey}>
      {options.map((o) => (
        <button key={o.label} type="button" role="menuitemradio" aria-checked={o.value === selected} className="opt" onClick={() => onPick(o.value)}>
          {o.dot && <span className="sw" style={{ background: `var(--${o.dot})` }} aria-hidden="true" />}
          <span>{o.label}</span>
        </button>
      ))}
      {extra}
    </div>
  );
}
