import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdbPersistence, PLANNER_DB_VERSION, type InitialView } from "./persistence";
import { viewOf } from "../../core/planner/records";
import { groupToday } from "../../features/tasks/selectors";
import { expandEvents } from "../../core/planner/occurrences";
import type { CalendarEvent, Task } from "../../core/planner/types";
import { LocalStore } from "./LocalStore";

beforeEach(() => { globalThis.indexedDB = new IDBFactory(); });
const clock = () => new Date("2026-11-07T10:00:00Z");

describe("staged durable loading", () => {
  it("publishes a covered Today before history, and retains edits during loading", async () => {
    const seed = new LocalStore({ persistence: new IdbPersistence(), broadcast: false, now: clock });
    await seed.ready;
    const current = seed.addTask({ title: "Today", due: "2026-11-07" });
    for (let i = 0; i < 530; i++) { const t = seed.addTask({ title: `old ${i}`, due: "2020-01-01" }); seed.updateTask(t.id, { done: true, completedAt: "2020-01-01T10:00:00Z" }); }
    await seed.flush(); seed.close();
    const store = new LocalStore({ persistence: new IdbPersistence(), broadcast: false, now: clock });
    await new Promise<void>((resolve) => { const off = store.subscribe(() => { if (store.getState().coverage?.today) { off(); resolve(); } }); });
    expect(store.getState().ready).toBe(false);
    expect(store.getState().tasks).toHaveLength(1);
    store.updateTask(current.id, { title: "edited while loading" });
    await store.ready; await store.flush();
    expect(store.getState().tasks).toHaveLength(531);
    expect(store.getState().tasks.find(t => t.id === current.id)?.title).toBe("edited while loading");
    expect(store.getState().coverage?.phase).toBe("complete");
    store.close();
  });

  it("rejects a stale operation inside its write transaction, without effects", async () => {
    const db = new IdbPersistence();
    const captured = await db.load();
    await db.apply({ at: clock().toISOString(), patches: [{ type: "list", id: "other", op: "create", key: "other", record: { id: "other", name: "Other", colour: "c1", isInbox: false } }] });
    await expect(db.apply({ at: clock().toISOString(), patches: [{ type: "list", id: "stale", op: "create", key: "stale", record: { id: "stale", name: "Stale", colour: "c1", isInbox: false } }] }, captured.stamp)).rejects.toThrow("changed");
    expect((await db.load()).lists.map(x => x.id)).toEqual(["other"]);
    const current = await db.load();
    await db.apply({ at: clock().toISOString(), patches: [{ type: "list", id: "fresh", op: "create", key: "fresh", record: { id: "fresh", name: "Fresh", colour: "c1", isInbox: false } }] }, current.stamp);
    expect((await db.load()).lists).toHaveLength(2);
    db.close();
  });
});

function barrier() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
const openRaw = (name = "orbyn-planner", version = PLANNER_DB_VERSION) => new Promise<IDBDatabase>((resolve, reject) => {
  const req = indexedDB.open(name, version); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
});
const done = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(tx.error); });
const patchList = (id: string) => ({ at: clock().toISOString(), patches: [{ type: "list" as const, id, op: "create" as const, key: id, record: { id, name: id, colour: "c1" as const, isInbox: false } }] });

describe("hydration reconciliation and cutover", () => {
  it("replays another writer's update and purge even when no broadcast is delivered", async () => {
    const persistence = new IdbPersistence();
    const seed = new LocalStore({ persistence, broadcast: false, now: clock });
    await seed.ready;
    const update = seed.addTask({ title: "before", due: "2026-11-07" });
    const remove = seed.addTask({ title: "remove", due: "2026-11-07" });
    await seed.flush(); seed.close();
    const paused = barrier(); const resume = barrier();
    class Paused extends IdbPersistence {
      override async scan(...args: Parameters<IdbPersistence["scan"]>) { paused.release(); await resume.promise; return super.scan(...args); }
    }
    const store = new LocalStore({ persistence: new Paused(), broadcast: false, now: clock });
    await paused.promise;
    const other = new IdbPersistence();
    await other.apply({ at: clock().toISOString(), patches: [
      { type: "task", id: update.id, op: "update", fields: { title: "other tab" }, key: "update" },
      { type: "task", id: remove.id, op: "purge", key: "purge" },
    ] });
    resume.release(); await store.ready;
    expect(store.getState().ready).toBe(true);
    expect(store.getState().tasks.map(t => t.title)).toEqual(["other tab"]);
    expect(store.getState().outbox.find(o => o.id === update.id)?.changedFields.title).toBe("other tab");
    expect(store.getState().outbox.find(o => o.id === remove.id)).toBeUndefined();
    store.close(); other.close();
  });

  it("fails visibly on a journal gap instead of claiming complete coverage", async () => {
    const paused = barrier(); const resume = barrier();
    class Paused extends IdbPersistence {
      override async scan(...args: Parameters<IdbPersistence["scan"]>) { paused.release(); await resume.promise; return super.scan(...args); }
    }
    const store = new LocalStore({ persistence: new Paused(), broadcast: false, now: clock });
    await paused.promise;
    const other = new IdbPersistence(); await other.apply(patchList("gap"));
    const raw = await openRaw(); const tx = raw.transaction("journal", "readwrite"); tx.objectStore("journal").clear(); await done(tx); raw.close();
    resume.release(); await store.ready;
    expect(store.getState().ready).toBe(false);
    expect(store.getState().coverage?.phase).toBe("failed");
    expect(store.getState().persistence.status).toBe("failed");
    store.close(); other.close();
  });

  it("keeps covered records and rejects edits when a background batch fails", async () => {
    const seed = new LocalStore({ persistence: new IdbPersistence(), broadcast: false, now: clock }); await seed.ready;
    seed.addTask({ title: "covered", due: "2026-11-07" }); await seed.flush(); seed.close();
    class Broken extends IdbPersistence { override scan(): Promise<never> { return Promise.reject(new Error("read failed")); } }
    const store = new LocalStore({ persistence: new Broken(), broadcast: false, now: clock }); await store.ready;
    expect(store.getState().tasks[0]?.title).toBe("covered");
    expect(store.getState().ready).toBe(false);
    expect(store.getState().coverage?.phase).toBe("failed");
    store.close();
  });

  it("reports a blocked upgrade, preserves v6 records, and rejects a v6 writer after cutover", async () => {
    const req = indexedDB.open("orbyn-planner", 6);
    req.onupgradeneeded = () => {
      for (const name of ["tasks", "lists", "events", "calendars", "projects", "tags"]) req.result.createObjectStore(name, { keyPath: "id" });
      req.result.createObjectStore("purgedTags");
      req.result.createObjectStore("outbox", { keyPath: "seq", autoIncrement: true }).createIndex("record", ["type", "id"], { unique: true });
    };
    const legacy = await new Promise<IDBDatabase>((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    const tx = legacy.transaction("lists", "readwrite"); tx.objectStore("lists").put({ id: "retained", name: "Retained", colour: "c1", isInbox: false }); await done(tx);
    const blocked = vi.fn(); const current = new IdbPersistence(); current.setHandlers({ onBlocked: blocked });
    const loading = current.load(); await vi.waitFor(() => expect(blocked).toHaveBeenCalled());
    legacy.close();
    const snapshot = await loading;
    expect(snapshot.lists[0]?.name).toBe("Retained");
    await expect(openRaw("orbyn-planner", 6)).rejects.toMatchObject({ name: "VersionError" });
    await current.apply(patchList("current"), snapshot.stamp);
    expect((await current.load()).lists).toHaveLength(2);
    current.close();
  });

  it("journals acknowledgements and validates changed outbox identities", async () => {
    const current = new IdbPersistence();
    await current.apply(patchList("entry"));
    const initial = await current.load(); const entry = initial.outbox[0]!;
    await current.acknowledge([{ type: entry.type, id: entry.id, idempotencyKey: "old-key" }]);
    expect((await current.changes(initial.stamp!)).outbox[0]?.entry?.idempotencyKey).toBe(entry.idempotencyKey);
    const beforeAck = await current.load();
    await current.acknowledge([{ type: entry.type, id: entry.id, idempotencyKey: entry.idempotencyKey }]);
    expect((await current.changes(beforeAck.stamp!)).outbox[0]?.entry).toBeNull(); current.close();
  });

  it("does not finish or emit after the account's store is closed", async () => {
    const pause = barrier(); const resume = barrier();
    class Paused extends IdbPersistence { override async bootstrap(view: InitialView) { const snapshot = await super.bootstrap(view); pause.release(); await resume.promise; return snapshot; } }
    const store = new LocalStore({ persistence: new Paused("account-a"), broadcast: false, now: clock });
    const listener = vi.fn(); store.subscribe(listener); await pause.promise; store.close(); const calls = listener.mock.calls.length;
    resume.release(); await store.ready;
    expect(listener).toHaveBeenCalledTimes(calls); expect(store.getState().ready).toBe(false);
  });
});

describe("covered query oracle and atomic preparation", () => {
  it("matches full-load Today recurrence, completion history and spanning/DST event results", async () => {
    const db = new IdbPersistence(); const seed = new LocalStore({ persistence: db, now: clock, broadcast: false }); await seed.ready;
    seed.addTask({ title: "overdue", due: "2020-01-01" });
    seed.addTask({ title: "tomorrow", due: "2026-11-08" });
    seed.addTask({ title: "later", due: "2030-01-01" });
    const completed = seed.addTask({ title: "completed", due: "2026-10-01" }); seed.setDone(completed.id, true);
    const repeated = seed.addTask({ title: "daily", due: "2026-11-06", repeat: { frequency: "daily", interval: 1, weekdays: [], end: { type: "never" } } }); seed.setDone(repeated.id, true);
    seed.addEvent({ title: "spans midnight", start: "2026-11-06T22:00", end: "2026-11-08T06:00" });
    seed.addEvent({ title: "old recurrence master", start: "2020-01-01T09:00", end: "2020-01-01T10:00", repeat: { frequency: "daily", interval: 1, weekdays: [], end: { type: "never" } } });
    seed.addEvent({ title: "DST zone", start: "2026-10-01T09:00", end: "2026-10-01T10:00", zone: "America/New_York", repeat: { frequency: "daily", interval: 1, weekdays: [], end: { type: "never" } } });
    seed.addEvent({ title: "all day span", start: "2026-11-01", end: "2026-11-10", allDay: true });
    seed.addEvent({ title: "unrelated old", start: "2001-01-01", end: "2001-01-01", allDay: true });
    await seed.flush();
    const first = await db.bootstrap({ kind: "today", start: "2026-11-07", end: "2026-11-13", completedSince: "2026-11-02T00:00:00.000Z" });
    const full = await db.load();
    const tasks = (records: Task[]) => records.map(t => viewOf("task", t) as Task);
    const events = (records: CalendarEvent[]) => records.map(e => viewOf("event", e) as CalendarEvent);
    expect(groupToday(tasks(first.tasks), clock())).toEqual(groupToday(tasks(full.tasks), clock()));
    expect(expandEvents(events(first.events), "2026-11-07", "2026-11-13")).toEqual(expandEvents(events(full.events), "2026-11-07", "2026-11-13"));
    expect(first.tasks.length).toBeLessThan(full.tasks.length);
    expect(first.events.length).toBeLessThan(full.events.length);
    seed.close();
  });

  it("rejects a paused feed replacement when another writer adds an event without broadcasting", async () => {
    const p = new IdbPersistence(); const store = new LocalStore({ persistence: p, now: clock, broadcast: false }); await store.ready;
    const cal = store.addSubscription("Feed", "c1", "https://example.test/feed.ics");
    store.replaceFeedEvents(cal.id, [{ title: "original", start: "2026-11-07", end: "2026-11-07", allDay: true }]);
    await store.flush(); await store.prepareSync();
    const pause = barrier(); const resume = barrier(); const apply = p.apply.bind(p); let once = true;
    vi.spyOn(p, "apply").mockImplementation(async (...args) => { if (once) { once = false; pause.release(); await resume.promise; } return apply(...args); });
    store.replaceFeedEvents(cal.id, [{ title: "replacement", start: "2026-11-07", end: "2026-11-07", allDay: true }]);
    await pause.promise;
    const other = new IdbPersistence();
    const original = (await other.load()).events[0]!;
    await other.apply({ at: clock().toISOString(), patches: [{ type: "event", id: "concurrent", op: "create", key: "external", local: true, record: { ...original, id: "concurrent", title: "concurrent" } }] });
    resume.release(); await store.flush();
    expect((await other.load()).events.map(e => e.title).sort()).toEqual(["concurrent", "original"]);
    expect(store.getState().persistence).toMatchObject({ status: "failed", reason: expect.stringContaining("changed") });
    await store.prepareSync();
    store.replaceFeedEvents(cal.id, [{ title: "current revision control", start: "2026-11-07", end: "2026-11-07", allDay: true }]); await store.flush();
    expect((await other.load()).events.map(e => e.title)).toEqual(["current revision control"]);
    store.close(); other.close();
  });

  it("freezes authoritative outbox ids and rejects a remote merge prepared before an unseen edit", async () => {
    const p = new IdbPersistence(); const store = new LocalStore({ persistence: p, now: clock, broadcast: false }); await store.ready;
    const t = store.addTask({ title: "original" }); await store.flush();
    const prepared = await store.prepareSync();
    const other = new IdbPersistence();
    await other.apply({ at: clock().toISOString(), patches: [{ type: "task", id: t.id, op: "update", fields: { title: "new local edit" }, key: "new-local" }] });
    await expect(store.applyRemote([{ type: "task", id: t.id, fields: { title: "remote" } }], prepared)).rejects.toThrow("changed");
    expect((await other.load()).tasks[0]?.title).toBe("new local edit");
    const fresh = await store.prepareSync();
    expect(fresh.outbox.find(o => o.id === t.id)?.idempotencyKey).toBe("new-local");
    expect(prepared.outbox.find(o => o.id === t.id)?.idempotencyKey).not.toBe("new-local");
    await store.applyRemote([{ type: "task", id: t.id, fields: { notes: "remote note" } }], fresh);
    expect((await other.load()).tasks[0]).toMatchObject({ title: "new local edit", notes: "remote note" });
    store.close(); other.close();
  });

  it("rechecks a covered one-off precondition if another tab changes it into a repeat", async () => {
    const seed = new LocalStore({ persistence: new IdbPersistence(), now: clock, broadcast: false }); await seed.ready;
    const t = seed.addTask({ title: "one-off", due: "2026-11-07" }); await seed.flush(); seed.close();
    const pause = barrier(); const resume = barrier();
    class Paused extends IdbPersistence { override async scan(...args: Parameters<IdbPersistence["scan"]>) { pause.release(); await resume.promise; return super.scan(...args); } }
    const p = new Paused(); const store = new LocalStore({ persistence: p, now: clock, broadcast: false }); await pause.promise;
    const other = new IdbPersistence();
    await other.apply({ at: clock().toISOString(), patches: [{ type: "task", id: t.id, op: "update", key: "repeat", fields: { repeat: { start: "2026-11-07", repeat: { frequency: "daily", interval: 1, weekdays: [], end: { type: "never" } } } } }] });
    store.setDone(t.id, true); await store.flush();
    expect((await other.load()).tasks[0]?.done).toBe(false);
    expect(store.getState().persistence.status).toBe("failed");
    resume.release(); await store.ready; store.close(); other.close();
  });

  it("keeps account data separate throughout partial loading", async () => {
    const a = new IdbPersistence("account-a"); const b = new IdbPersistence("account-b");
    await a.apply(patchList("only-a")); await b.apply(patchList("only-b"));
    const view: InitialView = { kind: "today", start: "2026-11-07", end: "2026-11-13", completedSince: "2026-11-02T00:00:00Z" };
    expect((await a.bootstrap(view)).lists.map(l => l.id)).toEqual(["only-a"]);
    expect((await b.bootstrap(view)).lists.map(l => l.id)).toEqual(["only-b"]);
    a.close(); b.close();
  });
});

describe("index efficiency and upgrade atomicity", () => {
  it("does not read historical completed source tasks for the first Today query", async () => {
    const db = new IdbPersistence(); const seed = new LocalStore({ persistence: db, now: clock, broadcast: false }); await seed.ready;
    const sample = seed.addTask({ title: "visible", due: "2026-11-07" }); await seed.flush();
    await db.apply({ at: clock().toISOString(), patches: Array.from({ length: 200 }, (_, i) => ({ type: "task" as const, id: `history-${i}`, op: "create" as const, key: `history-${i}`, record: { ...sample, id: `history-${i}`, done: true, completedAt: "2020-01-01T00:00:00Z" } })) });
    let reads = 0;
    const get = IDBObjectStore.prototype.get;
    const spy = vi.spyOn(IDBObjectStore.prototype, "get").mockImplementation(function(this: IDBObjectStore, key: IDBValidKey | IDBKeyRange) { if (this.name === "tasks") reads++; return get.call(this, key); });
    const first = await db.bootstrap({ kind: "today", start: "2026-11-07", end: "2026-11-13", completedSince: "2026-11-02T00:00:00Z" });
    spy.mockRestore();
    expect(first.tasks.map(t => t.id)).toEqual([sample.id]); expect(reads).toBe(1);
    seed.close();
  });

  it("aborts a failed index upgrade atomically and leaves the old schema readable", async () => {
    const old = await openRaw("abort-upgrade", 6); old.close();
    const factory = indexedDB; const open = factory.open.bind(factory);
    const spy = vi.spyOn(factory, "open").mockImplementation((...args: Parameters<IDBFactory["open"]>) => {
      const request = open(...args);
      request.addEventListener("upgradeneeded", () => { queueMicrotask(() => request.transaction?.abort()); });
      return request;
    });
    const current = new IdbPersistence("abort-upgrade");
    await expect(current.load()).rejects.toMatchObject({ name: "AbortError" });
    spy.mockRestore(); current.close();
    const recovered = await openRaw("abort-upgrade", 6);
    expect(recovered.version).toBe(6);
    expect(recovered.objectStoreNames.contains("meta")).toBe(false);
    recovered.close();
  });
});

describe("recoverable operations and close fencing", () => {
  it("clears only a recoverable stale-operation notice when a local retry succeeds", async () => {
    const p = new IdbPersistence(); const store = new LocalStore({ persistence: p, now: clock, broadcast: false }); await store.ready;
    const t = store.addTask({ title: "before" }); await store.flush();
    const other = new IdbPersistence(); await other.apply(patchList("external"));
    store.deleteTask(t.id); await store.flush();
    expect(store.getState().persistence).toMatchObject({ status: "failed", reason: expect.stringContaining("changed") });
    store.deleteTask(t.id); await store.flush();
    expect(store.getState().persistence.status).toBe("ok");
    expect((await other.load()).tasks[0]?.deletedAt).not.toBeNull(); store.close(); other.close();
  });

  it("does not reopen persistence for a queued write after close", async () => {
    const p = new IdbPersistence(); const store = new LocalStore({ persistence: p, now: clock, broadcast: false }); await store.ready; await store.flush();
    const apply = vi.spyOn(p, "apply"); const listener = vi.fn(); store.subscribe(listener);
    store.addTask({ title: "queued" }); const beforeClose = listener.mock.calls.length; store.close(); await store.flush();
    expect(apply).not.toHaveBeenCalled(); expect(listener).toHaveBeenCalledTimes(beforeClose);
    const other = new IdbPersistence(); expect((await other.load()).tasks).toHaveLength(0); other.close();
  });
});

it("keeps existing collection order and all unchanged refs across a no-op sync preparation", async () => {
  const p = new IdbPersistence(); const seed = new LocalStore({ persistence: p, now: clock, broadcast: false }); await seed.ready;
  const sample = seed.addTask({ title: "template", due: "2030-01-01" }); await seed.flush();
  await p.apply({ at: clock().toISOString(), patches: [
    { type: "task", id: "z", op: "create", key: "z", record: { ...sample, id: "z", due: "2026-11-07" } },
    { type: "task", id: "a", op: "create", key: "a", record: { ...sample, id: "a", due: "2030-01-01" } },
  ] }); seed.close();
  const store = new LocalStore({ persistence: new IdbPersistence(), now: clock, broadcast: false }); await store.ready; await store.flush();
  const before = store.getState(); expect(before.tasks[0]?.id).toBe("z");
  const after = await store.prepareSync();
  for (const key of ["tasks", "events", "lists", "projects", "tags", "calendars", "outbox"] as const) expect(after[key]).toBe(before[key]);
  expect(after.tasks.map(t => t.id)).toEqual(before.tasks.map(t => t.id));
  expect((await store.prepareSync()).outbox).toBe(before.outbox); store.close();
});
