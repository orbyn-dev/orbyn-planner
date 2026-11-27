import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalStore } from "./LocalStore";
import { IdbPersistence, PLANNER_DB_VERSION } from "./persistence";
import type { Ref } from "../../core/planner/outbox";
import type { Task } from "../../core/planner/types";

const at = "2026-11-07T10:00:00.000Z";
const clock = () => new Date(at);
const task = (id: string): Task => ({ id, title: id, notes: "", listId: "inbox", due: "2020-01-01", priority: "none", done: true, completedAt: "2020-01-01T00:00:00Z", deletedAt: null, checklist: [], tags: [], projectId: null, sectionId: null, repeat: null, reminder: null, completions: [], overrideOf: null, createdAt: at, updatedAt: at });
function barrier() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { release, promise }; }
class Channel {
  static instances: Channel[] = [];
  onmessage: ((event: MessageEvent<{ tab: string; refs: Ref[] }>) => void) | null = null;
  constructor(readonly name: string) { Channel.instances.push(this); }
  postMessage(): void {}
  close(): void {}
  static deliver(refs: Ref[]) { for (const channel of Channel.instances) channel.onmessage?.({ data: { tab: "another-tab", refs } } as MessageEvent<{ tab: string; refs: Ref[] }>); }
}
beforeEach(() => { globalThis.indexedDB = new IDBFactory(); Channel.instances = []; vi.stubGlobal("BroadcastChannel", Channel); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const transactionDone = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(tx.error); });
const openRaw = (name = "orbyn-planner", version = PLANNER_DB_VERSION) => new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open(name, version); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });

describe("PR207 persistence regressions", () => {
  it("keeps a newer pre-ready refresh when older final journal slices publish later", async () => {
    const seed = new IdbPersistence();
    const tagId = "00000000-0000-4000-8000-000000000001";
    await seed.apply({ at, patches: [{ type: "tag", id: tagId, op: "create", key: "tag", record: { id: tagId, name: "temporary", colour: "c1", deletedAt: null } }] });
    await seed.apply({ at, patches: Array.from({ length: 300 }, (_, i) => ({ type: "task" as const, id: `task-${String(i).padStart(3, "0")}`, op: "create" as const, key: `seed-${i}`, record: { ...task(`task-${String(i).padStart(3, "0")}`), [`tag:${tagId}`]: true } })) }); seed.close();
    const scanning = barrier(); const resumeScan = barrier(); const captured = barrier(); const resumeFinal = barrier();
    class Paused extends IdbPersistence {
      override async scan(...args: Parameters<IdbPersistence["scan"]>) { scanning.release(); await resumeScan.promise; return super.scan(...args); }
      override async changes(...args: Parameters<IdbPersistence["changes"]>) { const result = await super.changes(...args); captured.release(); await resumeFinal.promise; return result; }
    }
    const p = new Paused(); const store = new LocalStore({ persistence: p, now: clock }); await scanning.promise;
    const other = new IdbPersistence();
    await other.apply({ at, patches: Array.from({ length: 300 }, (_, i) => ({ type: "task" as const, id: `task-${String(i).padStart(3, "0")}`, op: "update" as const, key: `snapshot-${i}`, fields: { title: "older final snapshot" } })) });
    resumeScan.release(); await captured.promise;
    await other.apply({ at, patches: [{ type: "task", id: "task-299", op: "update", key: "newest-outbox", fields: { title: "newest refresh" } }, { type: "tag", id: tagId, op: "purge", key: "purge-tag", local: true }] });
    Channel.deliver([{ type: "task", id: "task-299" }, { type: "tag", id: tagId }]);
    await vi.waitFor(() => expect(store.getState().tasks.find(t => t.id === "task-299")?.title).toBe("newest refresh"));
    resumeFinal.release(); await store.ready;
    expect(store.getState().tasks.find(t => t.id === "task-299")?.title).toBe("newest refresh");
    expect(store.getState().outbox.find(o => o.id === "task-299")?.idempotencyKey).toBe("newest-outbox");
    store.updateTask("task-299", { notes: "clear the purged tag" }); await store.flush();
    expect((await other.load()).tasks.find(t => t.id === "task-299")).toHaveProperty(`tag:${tagId}`, false); store.close(); other.close();
  });

  it("does not advance its complete cursor over an unseen revision after a no-op write", async () => {
    const p = new IdbPersistence(); const store = new LocalStore({ persistence: p, now: clock }); await store.ready;
    const t = store.addTask({ title: "purged elsewhere" }); await store.flush();
    const other = new IdbPersistence();
    await other.apply({ at, patches: [
      { type: "task", id: t.id, op: "purge", key: "purge" },
      { type: "list", id: "unseen", op: "create", key: "unseen", record: { id: "unseen", name: "Unseen", colour: "c1", isInbox: false } },
    ] });
    store.updateTask(t.id, { title: "no-op because it is gone" }); await store.flush();
    Channel.deliver([{ type: "list", id: "unseen" }]);
    await vi.waitFor(() => expect(store.getState().lists.some(l => l.id === "unseen")).toBe(true));
    expect(store.getState().tasks.some(x => x.id === t.id)).toBe(false); store.close(); other.close();
  });

  it("blocks queued section deletion after its preceding optimistic task move fails", async () => {
    const p = new IdbPersistence(); const store = new LocalStore({ persistence: p, now: clock, broadcast: false }); await store.ready;
    const project = store.addProject({ name: "Project", colour: "c1" }); const section = store.addSection(project.id, "Section");
    const t = store.addTask({ title: "Member", projectId: project.id, sectionId: section.id }); await store.flush();
    const apply = p.apply.bind(p); vi.spyOn(p, "apply").mockRejectedValueOnce(new DOMException("full", "QuotaExceededError")).mockImplementation(apply);
    store.updateTask(t.id, { sectionId: null }); store.deleteSection(project.id, section.id); await store.flush();
    const durable = await p.load();
    expect(durable.tasks.find(x => x.id === t.id)?.sectionId).toBe(section.id);
    const fresh = new LocalStore({ persistence: new IdbPersistence(), now: clock, broadcast: false }); await fresh.ready;
    expect(fresh.getState().projects.find(x => x.id === project.id)?.sections.some(s => s.id === section.id)).toBe(true);
    expect(store.getState().persistence).toEqual({ status: "failed", reason: "This device is out of storage." }); store.close(); fresh.close();
  });

  it("prepares repeated sync snapshots through the journal instead of rereading the full database", async () => {
    const p = new IdbPersistence(); const store = new LocalStore({ persistence: p, now: clock, broadcast: false }); await store.ready;
    const t = store.addTask({ title: "current" }); await store.flush(); const load = vi.spyOn(p, "load");
    const first = await store.prepareSync(); const second = await store.prepareSync(); expect(second.tasks).toBe(first.tasks); expect(load).not.toHaveBeenCalled();
    const other = new IdbPersistence(); await other.apply({ at, patches: [{ type: "task", id: t.id, op: "update", key: "external", fields: { title: "authoritative" } }] });
    expect((await store.prepareSync()).tasks.find(x => x.id === t.id)?.title).toBe("authoritative"); expect(load).not.toHaveBeenCalled(); store.close(); other.close();
  });

  it("rejects a covered repeating task at the current database stamp without changing records or outbox", async () => {
    const p = new IdbPersistence(); const repeated = { ...task("repeat"), done: false, repeat: { start: "2026-11-07", repeat: { frequency: "daily" as const, interval: 1, weekdays: [], end: { type: "never" as const } }, skipped: [] } };
    await p.apply({ at, patches: [{ type: "task", id: repeated.id, op: "create", key: "initial", record: repeated }] }); const before = await p.load();
    await expect(p.apply({ at, patches: [{ type: "task", id: repeated.id, op: "update", key: "rejected", fields: { done: true } }] }, before.stamp, [{ id: repeated.id }])).rejects.toThrow("changed");
    expect(await p.load()).toEqual(before); p.close();
  });

  it("stores only record references in new journal entries", async () => {
    const p = new IdbPersistence(); await p.apply({ at, patches: [{ type: "task", id: "private", op: "create", key: "private", record: { ...task("private"), title: "must not remain in journal" } }] });
    const db = await openRaw(); const tx = db.transaction("journal", "readonly"); const req = tx.objectStore("journal").getAll(); await transactionDone(tx);
    expect(req.result[0].refs).toEqual([{ type: "task", id: "private" }]); expect(JSON.stringify(req.result)).not.toContain("must not remain"); db.close(); p.close();
  });

  it("strips legacy journal payloads on upgrade without changing source records or revision", async () => {
    const req = indexedDB.open("legacy-journal", 7);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of ["tasks", "lists", "events", "calendars", "projects", "tags"]) db.createObjectStore(name, { keyPath: "id" });
      db.createObjectStore("purgedTags"); db.createObjectStore("outbox", { keyPath: "seq", autoIncrement: true }).createIndex("record", ["type", "id"], { unique: true });
      db.createObjectStore("meta").put({ generation: "legacy", revision: 1 }, "stamp");
      db.createObjectStore("journal", { keyPath: "revision" }).put({ revision: 1, refs: [{ type: "task", id: "private", record: { title: "historic private payload" }, entry: { changedFields: { title: "historic private payload" } } }] });
      for (const [name, keys] of [["taskIndex", ["due", "status", "completed", "recurring"]], ["eventIndex", ["start", "end", "conservative"]]] as const) { const index = db.createObjectStore(name, { keyPath: "id" }); for (const key of keys) index.createIndex(key, key); }
      req.transaction!.objectStore("tasks").put(task("private"));
    };
    const old = await new Promise<IDBDatabase>((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); old.close();
    const p = new IdbPersistence("legacy-journal"); const snapshot = await p.load();
    expect(snapshot.tasks).toEqual([task("private")]); expect(snapshot.stamp).toEqual({ generation: "legacy", revision: 1 });
    const db = await openRaw("legacy-journal"); const tx = db.transaction("journal", "readonly"); const read = tx.objectStore("journal").getAll(); await transactionDone(tx);
    expect(read.result).toEqual([{ revision: 1, refs: [{ type: "task", id: "private" }] }]);
    await expect(openRaw("legacy-journal", 7)).rejects.toMatchObject({ name: "VersionError" }); db.close(); p.close();
  });
});
