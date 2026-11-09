import { useEffect, useRef, useState } from "react";
import { setSettingsTarget } from "../../state/settingsTarget";
import { useRouter } from "../../state/router";
import { Icon } from "../../ui/primitives/Icon";
import { usePopover } from "../../ui/primitives/usePopover";
import { usePlanner, useStore } from "../../state/store";

/**
 * The Calendars button and its popover (Planner Designs p-cal-calendars-popover): the person's calendars with a colour dot and a
 * visibility checkbox (unchecked ones are hidden from every view), a subscribed feed marked, and Manage calendars, which opens Settings
 * › Calendars. Escape or a click outside closes it and focus returns to the button.
 */
export function CalendarsMenu() {
  const store = useStore();
  const { calendars } = usePlanner();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const menu = usePopover(open, () => setOpen(false), anchor);

  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLButtonElement>("[role=menuitemcheckbox]")?.focus();
  }, [open, menu]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>("[role^=menuitem]") ?? [])];
    if (items.length === 0) return;
    e.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]!.focus();
  };

  return (
    <div className="sync-wrap">
      <button ref={anchor} type="button" className="ghost cal-btn" aria-label="Calendars" title="Calendars" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="cal" small />
        <span className="lbl">Calendars</span>
      </button>
      {open && (
        <div ref={menu} className="card popover cal-menu" role="menu" aria-label="Calendars" onKeyDown={onKey}>
          <div className="grp">Calendars</div>
          {calendars.map((c) => (
            <button
              key={c.id}
              type="button"
              role="menuitemcheckbox"
              aria-checked={c.visible}
              className="mi"
              onClick={() => store.updateCalendar(c.id, { visible: !c.visible })}
            >
              <span className={c.visible ? "check done" : "check"} aria-hidden="true" />
              <span className="sw" style={{ background: `var(--${c.colour})` }} aria-hidden="true" />
              <span className="what">{c.name}</span>
              {c.kind.type !== "local" && <span className="k t3">Subscribed</span>}
            </button>
          ))}
          <hr className="msep" />
          <button
            type="button"
            role="menuitem"
            className="mi"
            onClick={() => {
              setOpen(false);
              setSettingsTarget("Calendars");
              router.navigate("/settings");
            }}
          >
            <span className="what">Manage calendars</span>
            <span className="k" aria-hidden="true"><Icon name="right" small /></span>
          </button>
        </div>
      )}
    </div>
  );
}
