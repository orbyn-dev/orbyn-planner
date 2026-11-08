import { linksIn } from "../../app/links";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNow } from "../../app/clock";
import { usePrefs } from "../../app/prefs";
import { useUi } from "../../app/ui";
import { Portal } from "../../components/Portal";
import { PHONE_QUERY, useMediaQuery } from "../../components/useMediaQuery";
import { useDialog } from "../../components/useDialog";
import { dateKey, makeDue, parseDue } from "../../lib/dates";
import { usePlanner, useStore } from "../../store/context";
import { inOrder, keyBetween } from "../../store/order";
import { CannotMoveSeries, type Scope } from "../../store/eventScope";
import { allowedScopes, editTaskRepeat, undoableTasks, type RepeatEdit } from "../../store/taskRepeat";
import { MAX_TAGS_PER_TASK } from "../../store/records";
import { type ListColour, type Task } from "../../store/types";
import { ScopeDialog } from "../calendar/ScopeDialog";
import { DueRow, ListRow, PriorityRow, ReminderRow, RepeatRow, StatusRow } from "./RowPopovers";
import { TagsRow } from "./TagsRow";
import { needsAction } from "./selectors";
import { useComplete } from "./useComplete";
import { useSlow } from "../../lib/useSlow";
import { Icon } from "../../components/Icon";

const SAVE_DELAY_MS = 500;

function Panel({ task }: { task: Task }) {
  const store = useStore();
  const { lists, projects, tags } = usePlanner();
  const ui = useUi();
  const now = useNow();
  const { prefs } = usePrefs();
  const complete = useComplete();
  const ref = useRef<HTMLElement>(null);
  const phone = useMediaQuery(PHONE_QUERY);

  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [step, setStep] = useState("");
  // A change to a repeating task waits here while the person says how far it reaches.
  const [asking, setAsking] = useState<RepeatEdit | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Title and notes are saved a moment after typing stops, and always when the panel is left.
  const latest = useRef({ title, notes, task });
  useEffect(() => {
    latest.current = { title, notes, task };
  });
  const flush = useCallback(() => {
    const { title: t, notes: n, task: current } = latest.current;
    const patch: { title?: string; notes?: string } = {};
    if (t.trim() !== "" && t.trim() !== current.title) patch.title = t.trim();
    if (n !== current.notes) patch.notes = n;
    if (patch.title !== undefined || patch.notes !== undefined) {
      store.updateTask(current.id, patch);
      latest.current = { ...latest.current, task: { ...current, ...patch } };
    }
  }, [store]);
  useEffect(() => {
    const timer = setTimeout(flush, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [title, notes, flush]);
  useEffect(() => flush, [flush]);

  const close = () => {
    flush();
    ui.closeTask();
  };
  useDialog(ref, close, phone);

  const dayValue = task.due ? task.due.slice(0, 10) : "";
  const steps = inOrder(task.checklist);
  const doneSteps = task.checklist.filter((c) => c.done).length;

  const today = dateKey(now);
  /** Apply an edit to due or repeat; a repeating task asks how far it reaches first. */
  const edit = (change: RepeatEdit) => {
    if (task.repeat && change.due !== null) setAsking(change);
    else editTaskRepeat(store, task, change, "all", today);
  };

  const setDue = (day: string, time: string) => {
    // No day means no due date, so a time left in the field goes with it. A repeating task keeps
    // its date: stop the repeat first to remove it.
    if (!day) return task.repeat ? undefined : edit({ due: null });
    const base = parseDue(day).date;
    const [h = 0, m = 0] = time ? time.split(":").map(Number) : [];
    base.setHours(h, m);
    edit({ due: makeDue(base, time !== "") });
  };

  const choose = (scope: Scope) => {
    if (asking) {
      try {
        const { undo } = undoableTasks(store, () => editTaskRepeat(store, task, asking, scope, today));
        setSaveError(null);
        ui.showToast("Repeat changed", undo);
      } catch (e) {
        setSaveError(e instanceof CannotMoveSeries ? e.message : "Couldn’t save that change.");
      }
    }
    setAsking(null);
  };
  const cancelAsk = () => {
    setAsking(null);
  };
  const project = projects.find((p) => p.id === task.projectId);

  const commitTitle = () => {
    if (title.trim() === "") setTitle(task.title);
    else flush();
  };

  const addStep = () => {
    const text = step.trim();
    if (!text) return;
    // A new step goes last: a key after the current last one.
    const order = keyBetween(steps.at(-1)?.order ?? null, null);
    if (order === null) return;
    store.updateTask(task.id, { checklist: [...task.checklist, { id: crypto.randomUUID(), title: text, done: false, order }] });
    setStep("");
  };

  const remove = () => {
    flush();
    store.deleteTask(task.id);
    ui.closeTask();
    ui.showToast(`“${task.title}” deleted. Kept for 30 days.`, () => store.restoreTask(task.id), { focusUndo: true, focusRowOnUndo: task.id });
  };

  const panel = (
    <aside
      ref={ref}
      className="task-panel"
      role={phone ? "dialog" : "complementary"}
      aria-modal={phone ? "true" : undefined}
      aria-label="Task"
      tabIndex={-1}
      onBlur={(e) => {
        // Leaving the panel saves what was typed.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) flush();
      }}
    >
      <div className="tp-head">
        <input
          type="checkbox"
          className="check"
          checked={task.done}
          aria-label={`Complete ${task.title}`}
          onChange={(e) => complete(task, e.target.checked)}
        />
        <input
          className="tp-title"
          aria-label="Title"
          value={title}
          data-autofocus
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
        <button type="button" className="icon-btn" aria-label="Close" onClick={close}>
          <Icon name="x" />
        </button>
      </div>

      <DueRow due={task.due} now={now} weekStart={prefs.weekStart} style={needsAction(task, now) ? { color: "var(--amber-text)" } : undefined} onChange={setDue} />
      <ListRow lists={lists} value={task.listId} onChange={(listId) => store.updateTask(task.id, { listId })} onCreate={(name, colour) => store.addList(name, colour as ListColour).id} />
      <TagsRow tags={tags} taskTags={task.tags} max={MAX_TAGS_PER_TASK} onToggle={(id, on) => store.setTaskTag(task.id, id, on)} onCreate={(name, colour) => {
        // An existing tag of that name is used, not made twice.
        return tags.find((t) => t.deletedAt === null && t.name.toLowerCase() === name.toLowerCase()) ?? store.addTag(name, colour);
      }} />
      <PriorityRow value={task.priority} onChange={(priority) => store.updateTask(task.id, { priority })} />
      <RepeatRow rule={task.repeat?.repeat ?? null} start={dayValue || today} onChange={(rule) => edit({ repeat: rule })} />
      <ReminderRow value={task.reminder} onChange={(reminder) => store.updateTask(task.id, { reminder })} />
      <StatusRow task={task} onChange={(status) => store.updateTask(task.id, { status })} />
      {task.reminder !== null && !task.due && <p className="t3 hint">Set a due date to get this reminder.</p>}
      {projects.length > 0 && (
        <>
          <div className="kv">
            <span>Project</span>
            <b className="ctl">
              <select
                className="inp"
                aria-label="Project"
                value={task.projectId ?? ""}
                onChange={(e) => store.updateTask(task.id, { projectId: e.target.value || null, sectionId: null })}
              >
                <option value="">None</option>
                {projects.filter((p) => !p.archived || p.id === task.projectId).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </b>
          </div>
          {project && project.sections.length > 0 && (
            <div className="kv">
              <span>Section</span>
              <b className="ctl">
                <select
                  className="inp"
                  aria-label="Section"
                  value={task.sectionId ?? ""}
                  onChange={(e) => store.updateTask(task.id, { sectionId: e.target.value || null })}
                >
                  <option value="">No section</option>
                  {inOrder(project.sections).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </b>
            </div>
          )}
        </>
      )}

      <div className="bh">
        <b>Checklist</b>
        <span>{task.checklist.length > 0 ? `${doneSteps} of ${task.checklist.length}` : ""}</span>
      </div>
      <ul>
        {steps.map((item) => (
          <li key={item.id} className="row step-row" data-done={item.done}>
            <input
              type="checkbox"
              className="check"
              checked={item.done}
              aria-label={item.title}
              onChange={(e) =>
                store.updateTask(task.id, {
                  checklist: task.checklist.map((c) => (c.id === item.id ? { ...c, done: e.target.checked } : c)),
                })
              }
            />
            <span className="what">{item.title}</span>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Remove ${item.title}`}
              onClick={() => store.updateTask(task.id, { checklist: task.checklist.filter((c) => c.id !== item.id) })}
            >
              <Icon name="x" small />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="step-form"
        onSubmit={(e) => {
          e.preventDefault();
          addStep();
        }}
      >
        <input className="field" aria-label="Add a step" placeholder="Add a step" value={step} onChange={(e) => setStep(e.target.value)} />
      </form>

      <div className="bh"><b>Notes</b><span></span></div>
      <textarea
        className="field notes"
        aria-label="Notes"
        rows={4}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => notes !== task.notes && store.updateTask(task.id, { notes })}
      />
      {linksIn(notes).length > 0 && (
        <ul className="note-links" aria-label="Links in the notes">
          {linksIn(notes).map((u) => (
            <li key={u}>
              <a href={u} target="_blank" rel="noopener noreferrer" className="t3">{u}</a>
            </li>
          ))}
        </ul>
      )}

      <div className="tp-foot">
        <button type="button" className="ghost red" onClick={remove}>Delete</button>
        <button type="button" className="btn" onClick={() => complete(task, !task.done)}>
          {task.done ? "Mark not done" : "Complete"}
        </button>
      </div>
      {saveError && <p role="alert" className="t3">{saveError}</p>}
      {asking && <ScopeDialog title="Change" noun="task" allowed={allowedScopes(asking)} onChoose={choose} onCancel={cancelAsk} />}
    </aside>
  );
  return phone ? <Portal>{panel}</Portal> : panel;
}

/**
 * What the panel shows when the task it was asked for is not there (Planner Designs v51 p-task-loading, p-task-error): while the planner is
 * still being read, after 400 ms, a skeleton of its rows with "Loading this task"; once it has been read and the task is not in it (it may have
 * been deleted on another device), why, with Close and Try again. Red only because it failed.
 */
export function TaskPanelState({ taskId, ready }: { taskId: string; ready: boolean }) {
  const ui = useUi();
  const slow = useSlow(!ready);
  const [, again] = useState(0);
  if (!ready) {
    if (!slow) return null;
    return (
      <aside className="task-panel" role="complementary" aria-label="Task" aria-busy="true">
        <div className="tp-head">
          <span className="check" aria-hidden="true" />
          <span className="skel" style={{ width: "var(--sp-220)", height: "var(--sp-16)" }} />
        </div>
        <span role="status" className="t3 line"><span className="spin" aria-hidden="true" />Loading this task</span>
        {["Due", "List", "Priority", "Repeat", "Reminder"].map((label) => (
          <div className="kv" key={label}>
            <span>{label}</span>
            <span className="skel" style={{ width: "var(--sp-90)" }} />
          </div>
        ))}
      </aside>
    );
  }
  return (
    <aside className="task-panel" role="complementary" aria-label="Task" data-for={taskId}>
      <div className="card red-ring" role="alert">
        <span className="line"><span className="pv-red"><Icon name="alert" small /></span><b>Couldn’t open this task</b></span>
        <span className="t3">It may have been deleted on another device, or your connection dropped. Your other tasks are fine.</span>
        <span className="line">
          <button type="button" className="ghost" onClick={ui.closeTask}>Close</button>
          <button type="button" className="btn" onClick={() => again((n) => n + 1)}>Try again</button>
        </span>
      </div>
    </aside>
  );
}

export function TaskPanel() {
  const { tasks, ready } = usePlanner();
  const { taskId } = useUi();
  const task = tasks.find((t) => t.id === taskId && t.deletedAt === null);
  if (task) return <Panel key={task.id} task={task} />;
  return taskId === null ? null : <TaskPanelState taskId={taskId} ready={ready} />;
}
