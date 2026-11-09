import { useCallback, useMemo, useRef, useState } from "react";
import { MotionList } from "../../ui/primitives/MotionList";
import { useNow } from "../../state/clock";
import { Link } from "../../state/router";
import { useUi } from "../../ui/product/UiProvider";
import { EmptyState } from "../../ui/primitives/EmptyState";
import { useSlow } from "../../lib/useSlow";
import { useSyncStatus, withPersistence } from "../sync";
import { useSyncController, useSyncState } from "../../state/sync";
import { QuickAddField } from "../tasks";
import { Icon } from "../../ui/primitives/Icon";
import { usePopover } from "../../ui/primitives/usePopover";
import { usePlanner, useStore } from "../../state/store";
import { StrandedZones } from "../sync";
import { LIST_COLOURS, type ListColour, type TaskList } from "../../core/planner/types";
import { activeTasks, openCount, sortByDue } from "../tasks";
import { TaskRow } from "../tasks";
import { Swatch } from "../../ui/product/Swatch";

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

/**
 * The list could not be opened (Planner Designs p-lists-error): what failed, that the data is safe, and a way on. It shows when the list
 * the page was asked for is not in the planner once the planner has been read (it may have been deleted on another device). Red only because it failed.
 */
export function ListError({ name, onRetry, onOther }: { name: string; onRetry: () => void; onOther: () => void }) {
  return (
    <div className="lists-error">
      <div className="card red-ring" role="alert">
        <span className="line"><span className="pv-red"><Icon name="alert" small /></span><b>Couldn’t load {name}</b></span>
        <span className="t3">The list is safe on your other devices. Check your connection and try again.</span>
        <span className="line">
          <button type="button" className="ghost" onClick={onOther}>Open another list</button>
          <button type="button" className="btn" onClick={onRetry}>Try again</button>
        </span>
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
  const [, retry] = useState(0);
  /** The page was asked for a list the planner does not have (it was deleted elsewhere): said so, not quietly swapped for the first list. */
  const missing = ready && ui.listId !== null && !ordered.some((l) => l.id === ui.listId);

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
        {offline && (
          <div className="offline-banner">
            <div className="banner" role="status">
              <Icon name="cloudoff" small />
              You’re offline. Everything here is saved on this device and will sync when you’re back.
            </div>
          </div>
        )}
        {missing ? (
          <ListError name="this list" onRetry={() => retry((n) => n + 1)} onOther={() => ui.selectList(inbox?.id ?? ordered[0]?.id ?? "")} />
        ) : !ready ? (
          // Nothing for 400 ms; then the rows wait as bars under "Loading tasks", while the header and its actions stay (p-lists-loading).
          <div className="tbl-wrap" aria-busy="true">
            {skeleton && (
              <>
                <span role="status" className="t3 lists-loading"><span className="spin" aria-hidden="true" />Loading tasks</span>
                <ul className="tbl">
                  {[220, 160, 260, 190].map((w) => (
                    <li className="tr list" key={w} style={{ gridTemplateColumns: "var(--sp-22) minmax(0,1fr) var(--sp-110)" }}>
                      <span className="check" aria-hidden="true" />
                      <span className="skel" style={{ width: w }} />
                      <span className="skel" style={{ width: "var(--sp-60)" }} />
                    </li>
                  ))}
                </ul>
              </>
            )}
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
