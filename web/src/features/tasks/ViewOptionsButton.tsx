import { useRef, useState } from "react";
import { Link } from "../../app/router";
import { Toggle } from "../../components/Toggle";
import { usePopover } from "../../components/usePopover";
import type { ViewOptions } from "./viewOptions";

type Choice<T extends string> = { id: T; label: string };

function Group<T extends string>({ label, value, choices, onChange }: { label: string; value: T; choices: readonly Choice<T>[]; onChange: (v: T) => void }) {
  return (
    <div className="vo-group">
      <span className="vo-label">{label}</span>
      <div role="radiogroup" aria-label={label} className="pills">
        {choices.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={value === c.id} className="pill" onClick={() => onChange(c.id)}>
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const GROUPS: readonly Choice<ViewOptions["groupBy"]>[] = [
  { id: "none", label: "None" },
  { id: "due", label: "Due date" },
  { id: "list", label: "List" },
  { id: "priority", label: "Priority" },
];
const SORTS: readonly Choice<ViewOptions["sort"]>[] = [
  { id: "due", label: "Due date" },
  { id: "priority", label: "Priority" },
  { id: "created", label: "Created" },
  { id: "name", label: "Name" },
];
const BOARD_SORTS: readonly Choice<ViewOptions["boardSort"]>[] = SORTS.filter((s): s is Choice<ViewOptions["boardSort"]> => s.id !== "name");

/**
 * The View options button and its popover (Planner Designs p-view-options-list, p-view-options-board). The list groups and sorts and can
 * hide completed tasks; the board sorts within its lanes and can hide the Done lane. Changes apply at once. "Completed and deleted" lives here.
 */
export function ViewOptionsButton({ view, options, onChange }: { view: "list" | "board"; options: ViewOptions; onChange: (next: ViewOptions) => void }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const popover = usePopover(open, () => setOpen(false), anchor);
  const set = (patch: Partial<ViewOptions>) => onChange({ ...options, ...patch });
  return (
    <div className="sync-wrap">
      <button ref={anchor} type="button" className="ghost" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>View options</button>
      {open && (
        <div ref={popover} className="card popover view-options" role="dialog" aria-label="View options">
          {view === "list" ? (
            <>
              <Group label="Group by" value={options.groupBy} choices={GROUPS} onChange={(groupBy) => set({ groupBy })} />
              <Group label="Sort by" value={options.sort} choices={SORTS} onChange={(sort) => set({ sort })} />
              <div role="radiogroup" aria-label="Sort direction" className="pills">
                {([false, true] as const).map((d) => (
                  <button key={String(d)} type="button" role="radio" aria-checked={options.descending === d} className="pill" onClick={() => set({ descending: d })}>
                    {d ? "Descending" : "Ascending"}
                  </button>
                ))}
              </div>
              <div className="kv"><span>Show completed tasks</span><Toggle label="Show completed tasks" on={options.showCompleted} onChange={(showCompleted) => set({ showCompleted })} /></div>
            </>
          ) : (
            <>
              <Group label="Sort within lanes" value={options.boardSort} choices={BOARD_SORTS} onChange={(boardSort) => set({ boardSort })} />
              <div className="kv"><span>Show Done lane</span><Toggle label="Show Done lane" on={options.showDone} onChange={(showDone) => set({ showDone })} /></div>
            </>
          )}
          <Link to="/completed" className="kv vo-link" onClick={() => setOpen(false)}><span>Completed and deleted</span><span aria-hidden="true">›</span></Link>
        </div>
      )}
    </div>
  );
}
