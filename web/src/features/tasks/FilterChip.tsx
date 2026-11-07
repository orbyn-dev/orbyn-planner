import { useRef, useState } from "react";
import { OptionMenu, type MenuOption } from "../../components/OptionMenu";
import { usePopover } from "../../components/usePopover";

/**
 * A filter chip as drawn on Tasks (Planner Designs v49 work-list): a plain pill with the current choice and no chevron; it opens a short
 * menu of the choices. `label` names the filter for a screen reader, and the chip reads the choice ("Any due date", "High", "Work").
 */
export function FilterChip<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly MenuOption<T>[]; onChange: (value: T) => void }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const menu = usePopover(open, () => setOpen(false), anchor);
  const current = options.find((o) => o.value === value)?.label ?? "";
  return (
    <div className="sync-wrap">
      <button ref={anchor} type="button" className="pill chip" aria-label={`${label}: ${current}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {current}
      </button>
      {open && (
        <div ref={menu} className="card popover chip-menu" role="dialog" aria-label={label}>
          <OptionMenu label={label} options={options} selected={value} onPick={(v) => { onChange(v); setOpen(false); anchor.current?.focus(); }} />
        </div>
      )}
    </div>
  );
}
