import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNow } from "../../state/clock";
import { useRouter } from "../../state/router";
import { useUi } from "../../ui/product/UiProvider";
import { Icon } from "../../ui/primitives/Icon";
import { Portal } from "../../ui/primitives/Portal";
import { useDialog } from "../../ui/primitives/useDialog";
import { MONTHS, WEEKDAYS, dateKey, dateOf, makeDue, parseDue } from "../../core/planner/dates";
import { usePlanner, useStore } from "../../state/store";
import type { CalendarEvent, Project, Task, TaskList } from "../../core/planner/types";
import { describeRepeat, parseQuickAdd } from "../tasks";
import { isLive } from "../tasks";
import { Swatch } from "../../ui/product/Swatch";

type Item =
  | { kind: "add-task" | "add-event"; id: string; label: string }
  | { kind: "task"; id: string; task: Task; list?: TaskList }
  | { kind: "event"; id: string; event: CalendarEvent }
  | { kind: "list"; id: string; list: TaskList }
  | { kind: "project"; id: string; project: Project };

interface Section {
  title: string;
  items: Item[];
}

const DELETED_KEPT_MS = 30 * 86_400_000;

/** "Fri 13 Nov", with the year when it is not this year. */
function dayText(day: string, now: Date): string {
  const d = dateOf(day);
  const base = `${WEEKDAYS[d.getDay()]!.slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()]!.slice(0, 3)}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** Search or add (Planner Designs `search`, `p-search-none`): one field that finds any task, event, list or project, or adds a task or an event in plain words. */
export function SearchDialog() {
  const store = useStore();
  const { tasks, lists, events, projects } = usePlanner();
  const ui = useUi();
  const router = useRouter();
  const now = useNow();
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, ui.closeSearch);

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const q = query.trim();

  // What was written in plain words: the date, list and priority come out, and the title is what is left. When something came out, the title
  // starts with a capital ("dentist friday 3pm" adds "Dentist"); typed words with nothing in them stay as typed (Planner Designs `search`, `p-search-none`).
  const parsed = useMemo(() => {
    const p = parseQuickAdd(q, now, lists);
    const read = p.due !== null || p.listId !== null || p.repeat !== null || p.priority !== "none";
    return read ? { ...p, title: p.title.charAt(0).toUpperCase() + p.title.slice(1) } : p;
  }, [q, now, lists]);

  const { sections, found } = useMemo(() => {
    if (!q) return { sections: [] as Section[], found: false };
    // The search is for the words, not the date written after them: "dentist friday 3pm" looks for "dentist" (Planner Designs `search`).
    const needle = (parsed.title.trim() || q).toLowerCase();
    const hit = (text: string) => text.toLowerCase().includes(needle);
    // Completed tasks count, and so do tasks deleted in the last 30 days (they are on the Completed and deleted page).
    const matchedTasks = tasks
      .filter((t) => hit(t.title) && (isLive(t) || (t.deletedAt !== null && now.getTime() - new Date(t.deletedAt).getTime() <= DELETED_KEPT_MS)))
      .sort((a, b) => Number(a.deletedAt !== null) - Number(b.deletedAt !== null) || Number(a.done) - Number(b.done))
      .slice(0, 6);
    const matchedEvents = events.filter((e) => e.deletedAt === null && hit(e.title)).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 4);
    const matchedLists = lists.filter((l) => hit(l.name)).slice(0, 4);
    const matchedProjects = projects.filter((p) => hit(p.name)).slice(0, 4);
    const exact = tasks.some((t) => isLive(t) && t.title.trim().toLowerCase() === needle);

    const out: Section[] = [];
    if (!exact) {
      // A time written in the words says it is an event, so that comes first; otherwise a task does.
      const timed = parsed.due !== null && parseDue(parsed.due).hasTime;
      const bits = [
        parsed.due && `due ${dayText(parsed.due.slice(0, 10), now)}`,
        parsed.listId && lists.find((l) => l.id === parsed.listId)?.name,
        parsed.repeat && describeRepeat(parsed.repeat),
        parsed.priority !== "none" && `${parsed.priority} priority`,
      ].filter(Boolean);
      const when = parsed.due ? ` · ${dayText(parsed.due.slice(0, 10), now)}, ${timed ? parsed.due.slice(11, 16) : "all day"}` : "";
      const task: Item = { kind: "add-task", id: "add-task", label: `Add task “${parsed.title}”${bits.length ? ` · ${bits.join(" · ")}` : ""}` };
      const event: Item = { kind: "add-event", id: "add-event", label: `Add event “${parsed.title}”${when}` };
      out.push({ title: "Add", items: timed ? [event, task] : [task, event] });
    }
    if (matchedTasks.length) out.push({ title: "Tasks", items: matchedTasks.map((t) => ({ kind: "task" as const, id: `task-${t.id}`, task: t, list: lists.find((l) => l.id === t.listId) })) });
    if (matchedEvents.length) out.push({ title: "Calendar", items: matchedEvents.map((e) => ({ kind: "event" as const, id: `event-${e.id}`, event: e })) });
    if (matchedLists.length) out.push({ title: "Lists", items: matchedLists.map((l) => ({ kind: "list" as const, id: `list-${l.id}`, list: l })) });
    if (matchedProjects.length) out.push({ title: "Projects", items: matchedProjects.map((p) => ({ kind: "project" as const, id: `project-${p.id}`, project: p })) });
    return { sections: out, found: matchedTasks.length + matchedEvents.length + matchedLists.length + matchedProjects.length > 0 };
  }, [q, tasks, lists, events, projects, now, parsed]);

  const flat = sections.flatMap((s) => s.items);
  const current = Math.min(active, Math.max(flat.length - 1, 0));

  const pick = (item: Item | undefined) => {
    if (!item) return;
    if (item.kind === "add-task") {
      const task = store.addTask({ title: parsed.title, due: parsed.due, listId: parsed.listId ?? undefined, priority: parsed.priority, repeat: parsed.repeat });
      ui.closeSearch();
      ui.showToast(`Added “${task.title}”`);
    } else if (item.kind === "add-event") {
      ui.closeSearch();
      if (parsed.due) {
        const day = parsed.due.slice(0, 10);
        const timed = parseDue(parsed.due).hasTime;
        const start = parsed.due;
        // An hour long, which may run past midnight.
        const end = timed ? makeDue(new Date(parseDue(parsed.due).date.getTime() + 3_600_000), true) : day;
        const event = store.addEvent({ title: parsed.title, allDay: !timed, start, end });
        ui.showToast(`Added “${event.title}”`);
      } else {
        // No day or time was written: the New event card asks, with the title already in.
        ui.openNewEvent(dateKey(now), undefined, parsed.title);
      }
    } else if (item.kind === "task") {
      ui.closeSearch();
      if (item.task.deletedAt !== null) router.navigate("/completed");
      else ui.openTask(item.task.id);
    } else if (item.kind === "event") {
      ui.closeSearch();
      ui.openEvent(item.event.id, item.event.start.slice(0, 10));
      router.navigate("/calendar");
    } else if (item.kind === "project") {
      ui.closeSearch();
      router.navigate(`/projects/${item.project.id}`);
    } else if (item.kind === "list") {
      ui.closeSearch();
      ui.selectList(item.list.id);
      router.navigate("/lists");
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (flat.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current + step + flat.length) % flat.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(flat[current]);
    }
  };

  const activeItem = flat[current];

  return (
    <Portal>
    <div className="modal-back top" onMouseDown={(e) => e.target === e.currentTarget && ui.closeSearch()}>
      <div ref={ref} className="authcard" style={{ width: "var(--sp-620)", padding: "var(--sp-10)", gap: "var(--sp-4)" }} role="dialog" aria-modal="true" aria-label="Search or add" tabIndex={-1} onKeyDown={onKeyDown}>
        <div className="field bare">
          <Icon name="search" small />
          <input
            data-autofocus
            role="combobox"
            aria-label="Search or add"
            aria-expanded={flat.length > 0}
            aria-controls="search-results"
            aria-activedescendant={activeItem?.id}
            aria-autocomplete="list"
            placeholder="Search tasks and lists, or add: Call Sam tomorrow 3pm #work !high"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
          />
          {(activeItem?.kind === "add-task" || activeItem?.kind === "add-event") && <span className="t3 hint-right">Enter to add</span>}
        </div>
        <div id="search-results" role="listbox" aria-label="Results">
          {sections.map((section) => (
            <div key={section.title} role="group" aria-label={section.title}>
              <div className="grp" aria-hidden="true">{section.title}</div>
              {section.items.map((item) => (
                <div
                  key={item.id}
                  id={item.id}
                  role="option"
                  aria-selected={item === activeItem}
                  className={item === activeItem ? "nav on" : "nav"}
                  onMouseMove={() => setActive(flat.indexOf(item))}
                  onClick={() => pick(item)}
                >
                  {item.kind === "add-task" && (<><Icon name="check" small />{item.label}</>)}
                  {item.kind === "add-event" && (<><Icon name="cal" small />{item.label}</>)}
                  {item.kind === "task" && (<><Icon name="check" small />{item.task.title}<span className="n">{item.task.deletedAt !== null ? "Deleted" : item.list?.name}</span></>)}
                  {item.kind === "event" && (<><Icon name="cal" small />{item.event.title}<span className="n"> · {dayText(item.event.start.slice(0, 10), now)}</span></>)}
                  {item.kind === "list" && (<><Swatch colour={item.list.colour} />{item.list.name}</>)}
                  {item.kind === "project" && (<><Icon name="folder" small />{item.project.name}</>)}
                </div>
              ))}
            </div>
          ))}
        </div>
        {q && !found && (
          <div className="no-results" role="status">
            <b>No results for “{q}”</b>
            <span className="t3">Nothing in tasks, events, lists or projects matches. Search covers completed tasks and the last 30 days of deleted ones.</span>
          </div>
        )}
        {!q && <p className="t3 search-hint">Type to search, or add a task in plain words.</p>}
      </div>
    </div>
    </Portal>
  );
}
