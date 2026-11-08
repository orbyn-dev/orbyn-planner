import { useMemo, useState } from "react";
import { MotionList } from "../../components/MotionList";
import { useNow } from "../../app/clock";
import { useUi } from "../../app/ui";
import { EmptyState, PageHeader } from "../../components/EmptyState";
import { Icon } from "../../components/Icon";
import { formatDue } from "../../lib/dates";
import { usePlanner, useStore } from "../../store/context";
import { describeParse, parseQuickAdd } from "./quickAdd";
import { DUE_FILTERS, activeTasks, completedGroups, isLive, isOpen, matchesDue, type DueFilter } from "./selectors";
import { FilterChip } from "./FilterChip";
import { LANES, LANE_LABELS, laneOf, type Lane } from "../../store/taskStatus";
import { focusCard } from "../../lib/focus";
import { useMoveTask } from "./useMoveTask";
import { CardMenu, cardLabel, laneForKey } from "./CardMenu";
import { ViewOptionsButton } from "./ViewOptionsButton";
import { groupFor, lanesFor, loadViewOptions, saveViewOptions, type ViewOptions } from "./viewOptions";
import { tagLabels } from "./TagChips";
import { Swatch, TaskRow, useTaskActions } from "./TaskRow";
import type { Priority, Task } from "../../store/types";

type View = "list" | "board";

/** `listId` is where a task goes when the words name no list of their own (the open list on the Lists page). */
export function QuickAddField({ listId, example = "Call Sam tomorrow 3pm #work !high" }: { listId?: string; example?: string } = {}) {
  const store = useStore();
  const { lists, ready } = usePlanner();
  const ui = useUi();
  const now = useNow();
  const [text, setText] = useState("");
  const [keep, setKeep] = useState(false);
  const typed = text.trim();
  const parsed = useMemo(
    () => (keep ? { title: typed, due: null, listId: null, priority: "none" as const, repeat: null } : parseQuickAdd(text, now, lists)),
    [text, typed, keep, now, lists],
  );
  const preview = keep ? "" : describeParse(parsed, lists, now);

  return (
    <div className="addbar">
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!typed) return;
        const task = store.addTask({ title: parsed.title, due: parsed.due, listId: parsed.listId ?? listId, priority: parsed.priority, repeat: parsed.repeat });
        ui.showToast(`Added “${task.title}”`);
        setText("");
      }}
    >
      <input
        className="field"
        aria-label="Add a task"
        placeholder={`Add a task: ${example}`}
        value={text}
        disabled={!ready}
        onChange={(e) => setText(e.target.value)}
      />
    </form>
    <div className="hint-row">
      <p className="hint" aria-live="polite">{preview}</p>
      {(preview !== "" || keep) && (
        <label className="check-row">
          <input type="checkbox" className="check" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
          Keep as typed
        </label>
      )}
    </div>
    </div>
  );
}

/** A card of the Tasks board: draggable to another lane; the "…" menu and Alt+Left / Alt+Right move it for the keyboard (Planner Designs v52). */
function BoardCard({ task, index, of, onDragging }: { task: Task; index: number; of: number; onDragging: (id: string | null) => void }) {
  const { lists } = usePlanner();
  const { open } = useTaskActions(task);
  const move = useMoveTask();
  const now = useNow();
  const list = lists.find((l) => l.id === task.listId);
  const here = laneOf(task);
  const cardLanes = LANES.map((l) => ({ key: l, label: LANE_LABELS[l] }));
  return (
    <li
      className="tcard"
      data-row-id={task.id}
      data-done={task.done}
      tabIndex={0}
      aria-label={cardLabel(task.title, LANE_LABELS[here], index, of)}
      onKeyDown={(e) => {
        const to = laneForKey(e, cardLanes, here);
        if (to === null) return;
        e.preventDefault();
        move(task, to as Lane);
        focusCard(task.id);
      }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
        onDragging(task.id);
      }}
      onDragEnd={() => onDragging(null)}
    >
      <button type="button" className="tt link-btn" onClick={open}>{task.title}</button>
      <span className="m">
        {list && <Swatch colour={list.colour} />}
        {[list?.name, task.due && formatDue(task.due, now)].filter(Boolean).join(" · ")}
      </span>
      <CardMenu title={task.title} lanes={cardLanes} current={here} done={task.done} onOpen={open} onMarkDone={() => { move(task, "done"); focusCard(task.id); }} onMove={(l) => { move(task, l as Lane); focusCard(task.id); }} />
    </li>
  );
}

export function TasksPage() {
  const { tasks, lists, tags } = usePlanner();
  const ui = useUi();
  const now = useNow();
  const [view, setView] = useState<View>("list");
  const [options, setOptions] = useState<ViewOptions>(loadViewOptions);
  const change = (next: ViewOptions) => {
    setOptions(next);
    saveViewOptions(next);
  };
  const [due, setDue] = useState<DueFilter>("any");
  const [priority, setPriority] = useState<Priority | "any">("any");
  const [listId, setListId] = useState("");
  const [tagId, setTagId] = useState("");
  const liveTags = tags.filter((t) => t.deletedAt === null);
  const labels = tagLabels(tags);

  // Off (the default): open tasks, and tasks finished today staying where they were. On: every completed task too.
  const shown = useMemo(
    () => (options.showCompleted ? tasks.filter(isLive) : activeTasks(tasks, now)).filter((t) => matchesDue(t, due, now) && (priority === "any" || t.priority === priority) && (listId === "" || t.listId === listId) && (tagId === "" || t.tags.includes(tagId))),
    [tasks, now, due, priority, listId, tagId, options.showCompleted],
  );
  // On, the list keeps the finished ones apart, under Completed, by the day they were finished.
  const groups = useMemo(() => groupFor(options.showCompleted ? shown.filter((t) => !t.done) : shown, lists, now, options), [shown, lists, now, options]);
  const completed = useMemo(() => (options.showCompleted ? completedGroups(shown, now) : []), [shown, now, options.showCompleted]);
  const lanes = useMemo(() => lanesFor(shown, options), [shown, options]);
  const move = useMoveTask();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Lane | null>(null);
  const openCount = tasks.filter(isOpen).length;
  const anyTask = tasks.some((t) => t.deletedAt === null);

  return (
    <>
      <PageHeader title="Tasks" sub={view === "board" ? "Board" : `${openCount} open`}>
        <ViewOptionsButton view={view} options={options} onChange={change} />
        <button type="button" className="btn" onClick={() => ui.openNewTask()}>
          <Icon name="plus" small />
          Add a task
        </button>
      </PageHeader>

      <div className="filters">
        <div role="radiogroup" aria-label="View" className="pills">
          {(["list", "board"] as const).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={view === v} className="pill" onClick={() => setView(v)}>
              {v === "list" ? "List" : "Board"}
            </button>
          ))}
        </div>
        <span style={{ width: "var(--sp-12)" }} />
        <FilterChip label="Due date" value={due} options={DUE_FILTERS.map((f) => ({ value: f.id, label: f.label }))} onChange={setDue} />
        <FilterChip
          label="Priority"
          value={priority}
          options={[
            { value: "any", label: "Any priority" },
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low", label: "Low" },
            { value: "none", label: "None" },
          ]}
          onChange={setPriority}
        />
        <FilterChip label="List" value={listId} options={[{ value: "", label: "Any list" }, ...lists.map((l) => ({ value: l.id, label: l.name }))]} onChange={setListId} />
        {liveTags.length > 0 && (
          <FilterChip
            label="Tag"
            value={liveTags.some((t) => t.id === tagId) ? tagId : ""}
            options={[{ value: "", label: "Any tag" }, ...liveTags.map((t) => ({ value: t.id, label: labels.get(t.id) ?? t.name }))]}
            onChange={setTagId}
          />
        )}
        <button type="button" className="pill" style={{ marginLeft: "auto" }} onClick={ui.openSearch}>
          <Icon name="search" small />
          Search tasks
        </button>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title={anyTask ? "No tasks match" : "No tasks yet"}
          body={anyTask ? "Try another filter." : "Add one below, or use Add a task."}
        />
      ) : view === "list" ? (
        <div className="tbl-wrap">
          <ul className="tbl">
            <li className="tr h" aria-hidden="true" style={{ gridTemplateColumns: "var(--sp-22) minmax(0,1fr) var(--sp-120) var(--sp-110) var(--sp-70)" }}>
              <span /><span>Task</span><span>List</span><span>Due</span><span>Priority</span>
            </li>
          </ul>
          {groups.map((g) => (
            <section key={g.key} aria-label={g.label}>
              {g.label && (
                <div className="bh" style={{ padding: "var(--sp-8) var(--sp-4) var(--sp-4)" }}>
                  <b className={g.amber ? "amber" : undefined}>{g.label}</b>
                  <span>{g.tasks.filter((t) => !t.done).length}</span>
                </div>
              )}
              <MotionList className="tbl">
                {g.tasks.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </MotionList>
            </section>
          ))}
          {completed.length > 0 && (
            <section aria-label="Completed">
              <div className="bh" style={{ padding: "var(--sp-8) var(--sp-4) var(--sp-4)" }}>
                <b>Completed</b>
                <span>{completed.reduce((n, g) => n + g.tasks.length, 0)}</span>
              </div>
              {completed.map((g) => (
                <div key={g.key} role="group" aria-label={g.label}>
                  <div className="bh sub" style={{ padding: "var(--sp-4) var(--sp-4) var(--sp-2)" }}>
                    <span>{g.label}</span>
                  </div>
                  <MotionList className="tbl">
                    {g.tasks.map((t) => (
                      <TaskRow key={t.id} task={t} />
                    ))}
                  </MotionList>
                </div>
              ))}
            </section>
          )}
        </div>
      ) : (
        <div className="board" style={{ gridTemplateColumns: `repeat(${lanes.length}, minmax(0, 1fr))` }}>
          {lanes.map(({ lane, label, tasks: cards }) => (
            <section
              key={lane}
              className={over === lane ? "lane drop" : "lane"}
              aria-label={label}
              onDragOver={(e) => {
                if (dragging === null) return;
                e.preventDefault();
                setOver(lane);
              }}
              onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && over === lane && setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                const task = tasks.find((t) => t.id === (e.dataTransfer.getData("text/plain") || dragging));
                setOver(null);
                setDragging(null);
                if (task) move(task, lane);
              }}
            >
              <h2 className="lane-h">{label}<span>{cards.length}</span></h2>
              <ul className="cards">
                {cards.map((t, i) => (
                  <BoardCard key={t.id} task={t} index={i} of={cards.length} onDragging={setDragging} />
                ))}
              </ul>
              {over === lane && dragging !== null && <p className="t3 drop-hint">Drop to move to {label}</p>}
            </section>
          ))}
        </div>
      )}
      {view === "board" && (
        <p className="board-hint">
        <kbd>Tab</kbd> reaches a card · <kbd>Enter</kbd> or <kbd>Space</kbd> on … opens the menu · <kbd>Alt+←</kbd> <kbd>Alt+→</kbd> move the card one lane.
      </p>
      )}

      <QuickAddField />
    </>
  );
}
