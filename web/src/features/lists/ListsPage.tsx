import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MotionList } from "../../components/MotionList";
import { useNow } from "../../app/clock";
import { Link } from "../../app/router";
import { useUi } from "../../app/ui";
import { EmptyState } from "../../components/EmptyState";
import { motionMs } from "../../styles/tokens";
import { useSyncStatus, withPersistence } from "../sync/SyncLine";
import { useSyncController, useSyncState } from "../../sync/SyncProvider";
import { QuickAddField } from "../tasks/TasksPage";
import { Icon } from "../../components/Icon";
import { usePopover } from "../../components/usePopover";
import { usePlanner, useStore } from "../../store/context";
import { StrandedZones } from "../sync/StrandedZones";
import { LIST_COLOURS, type ListColour, type TaskList } from "../../store/types";
import { activeTasks, openCount, sortByDue } from "../tasks/selectors";
import { Swatch, TaskRow } from "../tasks/TaskRow";

const COLOUR_NAMES: Record<ListColour, string> = { c1: "Blue", c2: "Green", c3: "Purple", c4: "Orange" };

/**
 * The list header (Planner Designs lists, p-list-menu): the colour dot and the name (click the name to rename it), the open count, the
 * primary Add a task and a … menu with Rename, Colour and Completed and deleted. The sync state is global, not part of this header, and
 * there is no Share yet (sharing is Planned). The Inbox keeps its name and colour, so its menu has only Completed and deleted.
 */
function ListHeader({ list, sub }: { list: TaskList; sub: string }) {
  const store = useStore();
  const ui = useUi();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(list.name);
  const [menu, setMenu] = useState<"closed" | "items" | "colour">("closed");
  const anchor = useRef<HTMLButtonElement>(null);
  const pop = usePopover(menu !== "closed", () => setMenu("closed"), anchor);

  const rename = () => {
    setName(list.name);
    setEditing(true);
  };
  const save = () => {
    const next = name.trim();
    if (next && next !== list.name) store.updateList(list.id, { name: next });
    setEditing(false);
  };

  return (
    <div className="ph" key={list.id}>
      {editing ? (
        <form className="rename" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <input className="field" aria-label="List name" value={name} autoFocus onChange={(e) => setName(e.target.value)} onBlur={save} />
        </form>
      ) : (
        <h1>
          <Swatch colour={list.colour} />{" "}
          {list.isInbox ? list.name : <button type="button" className="name-btn" onClick={rename}>{list.name}</button>}
        </h1>
      )}
      <span className="sub">{sub}</span>
      <div className="acts">
        <div className="sync-wrap">
          <button ref={anchor} type="button" className="ghost" aria-label="More" title="More" aria-haspopup="menu" aria-expanded={menu !== "closed"} onClick={() => setMenu(menu === "closed" ? "items" : "closed")}>
            <svg viewBox="0 0 16 16" className="ic sm" fill="currentColor" aria-hidden="true"><circle cx="3.5" cy="8" r="1.3" /><circle cx="8" cy="8" r="1.3" /><circle cx="12.5" cy="8" r="1.3" /></svg>
          </button>
          {menu !== "closed" && (
            <div ref={pop} className="card popover list-menu" role="menu" aria-label="List menu">
              {menu === "colour" ? (
                <div role="radiogroup" aria-label="Colour" className="colours">
                  {LIST_COLOURS.map((c) => (
                    <button key={c} type="button" role="radio" aria-checked={list.colour === c} aria-label={COLOUR_NAMES[c]} className="colour-btn" onClick={() => { store.updateList(list.id, { colour: c }); setMenu("closed"); anchor.current?.focus(); }}>
                      <Swatch colour={c} />
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  {!list.isInbox && <button type="button" role="menuitem" className="mi" autoFocus onClick={() => { setMenu("closed"); rename(); }}>Rename</button>}
                  {!list.isInbox && <button type="button" role="menuitem" className="mi" onClick={() => setMenu("colour")}>Colour</button>}
                  <Link to="/completed" role="menuitem" className="mi" onClick={() => setMenu("closed")}>Completed and deleted</Link>
                </>
              )}
            </div>
          )}
        </div>
        <button type="button" className="btn" onClick={() => ui.openNewTask()}>
          <Icon name="plus" small />
          Add a task
        </button>
      </div>
    </div>
  );
}

/** True once `active` has lasted 400 ms: a quick load never flashes a skeleton. */
function useSlow(active: boolean): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setSlow(true), motionMs("wait"));
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [active]);
  return active && slow;
}

/**
 * The list could not be read (Planner Designs p-lists-error): what failed, that the data is safe, and a retry. Like Today's error it is
 * shown only when the local store reports a read failure, which it does not yet, so nothing renders it today.
 */
export function ListError({ name, onRetry, onOther }: { name: string; onRetry: () => void; onOther: () => void }) {
  return (
    <div className="empty" role="alert">
      <h2>Couldn’t load {name}</h2>
      <p>The list is safe on your other devices. Check your connection and try again.</p>
      <div className="acts">
        <button type="button" className="ghost" onClick={onOther}>Open another list</button>
        <button type="button" className="btn" onClick={onRetry}>Try again</button>
      </div>
    </div>
  );
}

export function ListsPage() {
  const store = useStore();
  const { lists, tasks, ready, outbox, persistence } = usePlanner();
  const ui = useUi();
  const now = useNow();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [find, setFind] = useState("");

  const ordered = useMemo(() => [...lists].sort((a, b) => Number(b.isInbox) - Number(a.isInbox)), [lists]);
  const selected = ordered.find((l) => l.id === ui.listId) ?? ordered[0];
  const shown = useMemo(
    () => (selected ? sortByDue(activeTasks(tasks, now).filter((t) => t.listId === selected.id)) : []),
    [tasks, now, selected],
  );
  const inbox = ordered.find((l) => l.isInbox);
  const mine = ordered.filter((l) => !l.isInbox && l.name.toLowerCase().includes(find.trim().toLowerCase()));

  // Offline is ink, not alarm: the pill says how many changes wait, rows say theirs has not left this device (p-lists-offline).
  const waiting = useMemo(() => {
    const latest = new Map<string, string>();
    for (const e of outbox) if (e.type === "task") latest.set(e.id, e.updatedAt);
    return [...latest].flatMap(([id, at]) => {
      const task = tasks.find((t) => t.id === id);
      return task ? [{ id, label: task.title, at }] : [];
    });
  }, [outbox, tasks]);
  const sync = useSyncState();
  const controller = useSyncController();
  const syncNow = useCallback(() => controller?.syncNow(), [controller]);
  const { status: health } = useSyncStatus(outbox.length, sync, syncNow);
  const status = withPersistence(health, persistence);
  const offline = status.kind === "offline";
  const unsynced = new Set(offline ? waiting.map((w) => w.id) : []);
  const skeleton = useSlow(!ready);

  const create = () => {
    const name = newName.trim();
    if (name) {
      const list = store.addList(name, LIST_COLOURS[lists.length % LIST_COLOURS.length]!);
      ui.selectList(list.id);
    }
    setNewName("");
    setAdding(false);
  };

  const count = (id: string) => (
    <span className="n" aria-label={`${openCount(tasks, id)} open`}>{openCount(tasks, id)}</span>
  );

  return (
    <div className="split">
      <nav className="l" aria-label="Your lists">
        <label className="search">
          <Icon name="search" small />
          <input placeholder="Find a list" aria-label="Find a list" value={find} onChange={(e) => setFind(e.target.value)} />
        </label>
        {inbox && (
          <button type="button" className={selected?.id === inbox.id ? "nav on" : "nav"} aria-current={selected?.id === inbox.id ? "true" : undefined} onClick={() => ui.selectList(inbox.id)}>
            <Icon name="inbox" small />
            Inbox
            {count(inbox.id)}
          </button>
        )}
        <div className="grp">My lists</div>
        {mine.map((l) => (
          <button key={l.id} type="button" className={selected?.id === l.id ? "nav on" : "nav"} aria-current={selected?.id === l.id ? "true" : undefined} onClick={() => ui.selectList(l.id)}>
            <Swatch colour={l.colour} />
            {l.name}
            {count(l.id)}
          </button>
        ))}
        {adding ? (
          <form
            style={{ marginTop: "var(--sp-8)" }}
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
          >
            <input className="field" aria-label="New list name" placeholder="List name" value={newName} autoFocus onChange={(e) => setNewName(e.target.value)} onBlur={create} />
          </form>
        ) : (
          <button type="button" className="nav" style={{ marginTop: "var(--sp-8)" }} disabled={!ready} onClick={() => setAdding(true)}>
            <Icon name="plus" small />
            New list
          </button>
        )}
        <StrandedZones only="list" />
      </nav>

      <div className="r" aria-label={selected?.name ?? "List"} role="region">
        {selected && <ListHeader list={selected} sub={[`${openCount(tasks, selected.id)} open`, offline && "offline"].filter(Boolean).join(" · ")} />}
        {offline && <p className="t3 offline-note">You’re offline. Everything here is saved on this device and will sync when you’re back.</p>}
        {!ready ? (
          <div className="tbl-wrap" role="status" aria-label="Loading tasks" aria-busy="true">
            {skeleton && (
              <ul className="tbl">
                {Array.from({ length: 4 }, (_, i) => (
                  <li className="tr list" key={i} style={{ gridTemplateColumns: "var(--sp-22) minmax(0,1fr) var(--sp-110)" }}>
                    <span /><span className="skel" /><span className="skel" />
                  </li>
                ))}
              </ul>
            )}
            <span className="t3">Loading tasks</span>
          </div>
        ) : shown.length === 0 ? (
          <EmptyState title={`No tasks in ${selected?.name ?? "this list"}`} body="Add the first one, or move a task here from another list.">
            <button type="button" className="btn" onClick={() => ui.openNewTask()}>Add a task</button>
          </EmptyState>
        ) : (
          <div className="tbl-wrap">
            <MotionList className="tbl">
              {shown.map((t) => (
                <TaskRow key={t.id} task={t} layout="list" unsynced={unsynced.has(t.id)} />
              ))}
            </MotionList>
          </div>
        )}
        {selected && <QuickAddField listId={selected.id} example="Post the parcel tomorrow" />}
      </div>
    </div>
  );
}
