import { useState } from "react";
import { OptionMenu, type MenuOption } from "../../ui/primitives/OptionMenu";
import { PopoverRow } from "../../ui/primitives/PopoverRow";
import type { PlannerCalendar } from "../../core/planner/types";

/** The event's calendar: a searchable list of the calendars with their colours (p-row-calendar). */
export function CalendarRow({ calendars, value, disabled, onChange }: { calendars: readonly PlannerCalendar[]; value: string; disabled?: boolean; onChange: (id: string) => void }) {
  const [find, setFind] = useState("");
  const options: MenuOption<string>[] = calendars
    .filter((c) => c.name.toLowerCase().includes(find.trim().toLowerCase()))
    .map((c) => ({ value: c.id, label: c.name, dot: c.colour }));
  return (
    <PopoverRow label="Calendar" value={calendars.find((c) => c.id === value)?.name ?? ""} disabled={disabled}>
      {({ close }) => (
        <>
          <input
            className="field"
            aria-label="Search calendars"
            placeholder="Search calendars"
            value={find}
            autoFocus
            onChange={(e) => setFind(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowDown") return;
              e.preventDefault();
              e.currentTarget.parentElement?.querySelector<HTMLButtonElement>("[role=menuitemradio]")?.focus();
            }}
          />
          <OptionMenu label="Calendars" options={options} selected={value} focusOnMount={false} onPick={(id) => { onChange(id); close(); }} />
        </>
      )}
    </PopoverRow>
  );
}
