import { useRef, type ReactNode } from "react";
import { Icon } from "../../ui/primitives/Icon";
import { Portal } from "../../ui/primitives/Portal";
import { useDialog } from "../../ui/primitives/useDialog";
import type { Tag, Task, TaskList } from "../../core/planner/types";
import { DUE_CHOICES, NO_FILTERS, PRIORITY_CHOICES, STATUS_CHOICES, filterCount, toggle, type TaskFilters } from "./taskFilters";
import { tagLabels } from "./TagChips";

/** Words in the title, the list's name or a tag's name: what the narrow search looks at (Planner Designs v70 p-narrow-tasks-search-480). */
export function matchesQuery(task: Task, query: string, lists: readonly TaskList[], tags: readonly Tag[]): boolean {
  const q = query.toLowerCase();
  const labels = tagLabels(tags);
  return (
    task.title.toLowerCase().includes(q) ||
    (lists.find((l) => l.id === task.listId)?.name.toLowerCase().includes(q) ?? false) ||
    task.tags.some((id) => (labels.get(id) ?? "").toLowerCase().includes(q))
  );
}

/** The title with the typed words picked out. */
export function Highlighted({ text, query }: { text: string; query: string }): ReactNode {
  const q = query.trim();
  const at = q === "" ? -1 : text.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <span className="hl">{text.slice(at, at + q.length)}</span>
      {text.slice(at + q.length)}
    </>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <div className="bh"><b>{title}</b><span></span></div>
      <div className="cg">{children}</div>
    </>
  );
}

function Choice({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className={on ? "pill on" : "pill"} aria-pressed={on} onClick={onClick}>
      {label}
    </button>
  );
}

/** The Filters sheet that rises over the list below 640 px: chip groups, several chips of a group can be on, and the list is filtered live (Planner Designs v70 p-narrow-tasks-filters-480). */
export function FiltersSheet({ filters, onChange, lists, tags, onClose }: { filters: TaskFilters; onChange: (next: TaskFilters) => void; lists: readonly TaskList[]; tags: readonly Tag[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, onClose);
  const labels = tagLabels(tags);
  const count = filterCount(filters);
  return (
    <Portal>
      <div className="modal-back sheet-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div ref={ref} className="authcard filter-sheet" role="dialog" aria-modal="true" aria-label="Filters" tabIndex={-1}>
          <div className="grab" aria-hidden="true" />
          <div className="fh"><b>Filters</b><span>{count} selected</span></div>
          <Group title="Status">
            {STATUS_CHOICES.map((s) => (
              <Choice key={s.id} on={filters.statuses.includes(s.id)} label={s.label} onClick={() => onChange({ ...filters, statuses: toggle(filters.statuses, s.id) })} />
            ))}
          </Group>
          <Group title="List">
            {lists.map((l) => (
              <Choice key={l.id} on={filters.lists.includes(l.id)} label={l.name} onClick={() => onChange({ ...filters, lists: toggle(filters.lists, l.id) })} />
            ))}
          </Group>
          <Group title="Priority">
            {PRIORITY_CHOICES.map((p) => (
              <Choice key={p.id} on={filters.priorities.includes(p.id)} label={p.label} onClick={() => onChange({ ...filters, priorities: toggle(filters.priorities, p.id) })} />
            ))}
          </Group>
          <Group title="Due">
            {DUE_CHOICES.map((d) => (
              <Choice key={d.id} on={filters.dues.includes(d.id)} label={d.label} onClick={() => onChange({ ...filters, dues: toggle(filters.dues, d.id) })} />
            ))}
          </Group>
          {tags.some((t) => t.deletedAt === null) && (
            <Group title="Tags">
              {tags.filter((t) => t.deletedAt === null).map((t) => (
                <Choice key={t.id} on={filters.tags.includes(t.id)} label={`#${labels.get(t.id) ?? t.name}`} onClick={() => onChange({ ...filters, tags: toggle(filters.tags, t.id) })} />
              ))}
            </Group>
          )}
          <div className="fa">
            <button type="button" className="ghost" onClick={() => onChange(NO_FILTERS)}>Clear</button>
            <button type="button" className="btn" data-autofocus onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

/** The chips under the filter bar that name each filter that is on, each with a remove icon, and Clear all (Planner Designs v70 p-narrow-tasks-filters-active-480). */
export function ActiveFilters({ filters, onChange, lists, tags }: { filters: TaskFilters; onChange: (next: TaskFilters) => void; lists: readonly TaskList[]; tags: readonly Tag[] }) {
  const labels = tagLabels(tags);
  const chips: { key: string; label: string; remove: () => void }[] = [];
  const defaultStatus = filters.statuses.length === 1 && filters.statuses[0] === "open";
  if (!defaultStatus) for (const s of filters.statuses) chips.push({ key: `s-${s}`, label: STATUS_CHOICES.find((c) => c.id === s)!.label, remove: () => onChange({ ...filters, statuses: filters.statuses.filter((v) => v !== s).length === 0 ? NO_FILTERS.statuses : filters.statuses.filter((v) => v !== s) }) });
  for (const id of filters.lists) chips.push({ key: `l-${id}`, label: lists.find((l) => l.id === id)?.name ?? "List", remove: () => onChange({ ...filters, lists: filters.lists.filter((v) => v !== id) }) });
  for (const p of filters.priorities) chips.push({ key: `p-${p}`, label: PRIORITY_CHOICES.find((c) => c.id === p)!.label, remove: () => onChange({ ...filters, priorities: filters.priorities.filter((v) => v !== p) }) });
  for (const d of filters.dues) chips.push({ key: `d-${d}`, label: DUE_CHOICES.find((c) => c.id === d)!.label, remove: () => onChange({ ...filters, dues: filters.dues.filter((v) => v !== d) }) });
  for (const id of filters.tags) chips.push({ key: `t-${id}`, label: `#${labels.get(id) ?? id}`, remove: () => onChange({ ...filters, tags: filters.tags.filter((v) => v !== id) }) });
  if (chips.length === 0) return null;
  return (
    <div className="actv">
      {chips.map((c) => (
        <span key={c.key} className="pill sm">
          {c.label}
          <button type="button" className="chip-x" aria-label={`Remove ${c.label}`} onClick={c.remove}>
            <Icon name="x" small />
          </button>
        </span>
      ))}
      <button type="button" className="ghost sm" onClick={() => onChange(NO_FILTERS)}>Clear all</button>
    </div>
  );
}
