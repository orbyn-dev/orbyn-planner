import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { usePopover } from "./usePopover";

/**
 * A row of the task and event panels whose value opens a popover anchored to the row (Planner Designs p-row-due and the frames that follow
 * it). The popover applies changes as they are picked, so there is no Save; Escape or a click outside closes it and focus returns to the
 * row's value. `children` gets `close`, which also returns focus.
 */
export function PopoverRow({ label, value, disabled, style, wide, children }: { label: string; value: string; disabled?: boolean; style?: CSSProperties; wide?: boolean; children: (api: { close: () => void }) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const pop = usePopover(open, () => setOpen(false), anchor);
  // A pick closes the popover and puts focus back on the row's value.
  const [back, setBack] = useState(0);
  useEffect(() => {
    if (back > 0) anchor.current?.focus();
  }, [back]);
  const close = () => {
    setOpen(false);
    setBack((n) => n + 1);
  };
  return (
    <div className="kv">
      <span>{label}</span>
      <b className="ctl sync-wrap" style={style}>
        <button ref={anchor} type="button" className="inp rowval" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-label={`${label}, ${value}`} onClick={() => setOpen(!open)}>
          {value}
        </button>
        {open && (
          <div ref={pop} className={wide ? "card popover row-pop wide" : "card popover row-pop"} role="dialog" aria-label={label}>
            {children({ close })}
            <p className="t3 row-pop-note">Changes apply as you pick; there is no Save. Escape or a click outside closes it and focus returns to the row.</p>
          </div>
        )}
      </b>
    </div>
  );
}
