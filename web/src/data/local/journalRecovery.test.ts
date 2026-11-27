import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalStore } from "./LocalStore";
import { IdbPersistence, PLANNER_DB_VERSION } from "./persistence";
import type { Ref } from "../../core/planner/outbox";

const at = "2026-11-07T10:00:00.000Z";
const clock = () => new Date(at);
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
const openRaw = () => new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open("orbyn-planner", PLANNER_DB_VERSION); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });

/** A current database whose last 4096 revisions no longer cover the caller's revision. */
async function pruneHistory(p: IdbPersistence, ref: Ref) {
  const snapshot = await p.load();
  const stamp = snapshot.stamp!;
  const db = await openRaw(); const tx = db.transaction(["meta", "journal"], "readwrite");
  tx.objectStore("meta").put({ ...stamp, revision: stamp.revision + 4097 }, "stamp");
  const journal = tx.objectStore("journal"); journal.clear();
  for (let index = 2; index <= 4097; index++) journal.put({ revision: stamp.revision + index, refs: index === 4097 ? [ref] : [] });
  await transactionDone(tx); db.close();
}

describe("bounded journal recovery", () => {
  it("recovers a pruned history with one complete snapshot, then resumes journal-only preparation", async () => {
    const p = new IdbPersistence(); const store = new LocalStore({ persistence: p, now: clock, broadcast: false }); await store.ready;
    const task = store.addTask({ title: "before idle" }); await store.flush();
    const other = new IdbPersistence(); await other.apply({ at, patches: [{ type: "task", id: task.id, op: "update", key: "latest", fields: { title: "after idle" } }] });
    await pruneHistory(other, { type: "task", id: task.id }); const load = vi.spyOn(p, "load");
    const recovered = await store.prepareSync(); expect(recovered.tasks.find(t => t.id === task.id)?.title).toBe("after idle"); expect(load).toHaveBeenCalledTimes(1);
    expect((await store.prepareSync()).tasks).toBe(recovered.tasks); expect(load).toHaveBeenCalledTimes(1); store.close(); other.close();
  });

  it("retries the recovered snapshot if a local edit commits while that full read is in flight", async () => {
    const p = new IdbPersistence(); const store = new LocalStore({ persistence: p, now: clock, broadcast: false }); await store.ready;
    const task = store.addTask({ title: "before" }); await store.flush(); await pruneHistory(p, { type: "task", id: task.id });
    const captured = barrier(); const resume = barrier(); const load = p.load.bind(p); let first = true;
    const spy = vi.spyOn(p, "load").mockImplementation(async () => { const snapshot = await load(); if (first) { first = false; captured.release(); await resume.promise; } return snapshot; });
    const preparing = store.prepareSync(); await captured.promise;
    store.updateTask(task.id, { title: "new edit during recovery" }); await store.flush(); resume.release();
    expect((await preparing).tasks.find(t => t.id === task.id)?.title).toBe("new edit during recovery");
    expect(spy).toHaveBeenCalledTimes(2); await store.prepareSync(); expect(spy).toHaveBeenCalledTimes(2); store.close();
  });

  it("fails closed if recovery reads a different generation or fails to read a snapshot", async () => {
    const p = new IdbPersistence(); const store = new LocalStore({ persistence: p, now: clock, broadcast: false }); await store.ready; await store.flush();
    await pruneHistory(p, { type: "list", id: "inbox" }); const before = store.getState(); const original = await p.load();
    const load = vi.spyOn(p, "load").mockResolvedValueOnce({ ...original, stamp: { ...original.stamp!, generation: "another-database" } });
    await expect(store.prepareSync()).rejects.toThrow("database changed"); expect(store.getState()).toBe(before);
    load.mockRejectedValueOnce(new Error("snapshot read failed")); await expect(store.prepareSync()).rejects.toThrow("snapshot read failed"); expect(store.getState()).toBe(before); store.close();
  });

  it("does not fall back to a full read for a generation mismatch or an unrelated storage failure", async () => {
    const p = new IdbPersistence(); const store = new LocalStore({ persistence: p, now: clock, broadcast: false }); await store.ready; await store.flush();
    const load = vi.spyOn(p, "load"); const changes = vi.spyOn(p, "changes");
    changes.mockRejectedValueOnce(new Error("database generation changed")); await expect(store.prepareSync()).rejects.toThrow("generation changed"); expect(load).not.toHaveBeenCalled();
    changes.mockRejectedValueOnce(new Error("read refused")); await expect(store.prepareSync()).rejects.toThrow("read refused"); expect(load).not.toHaveBeenCalled(); store.close();
  });
});

describe("refresh while local edits are pending", () => {
  it("reconciles a purge and its outbox absence after the last queued edit no-ops", async () => {
    const pause = barrier(); const resume = barrier();
    class Paused extends IdbPersistence { paused = false; override async apply(...args: Parameters<IdbPersistence["apply"]>) { if (this.paused) { this.paused = false; pause.release(); await resume.promise; } return super.apply(...args); } }
    const p = new Paused(); const store = new LocalStore({ persistence: p, now: clock }); await store.ready;
    const task = store.addTask({ title: "pending" }); await store.flush();
    p.paused = true; store.updateTask(task.id, { notes: "first pending edit" }); await pause.promise;
    const other = new IdbPersistence(); await other.apply({ at, patches: [
      { type: "task", id: task.id, op: "purge", key: "purge" },
      { type: "list", id: "other-list", op: "create", key: "list", record: { id: "other-list", name: "Other", colour: "c1", isInbox: false } },
    ] });
    const changed = vi.fn(); store.subscribe(changed); Channel.deliver([{ type: "task", id: task.id }]);
    await vi.waitFor(() => expect(changed).toHaveBeenCalled());
    expect(store.getState().tasks.find(t => t.id === task.id)?.notes).toBe("first pending edit");
    store.updateTask(task.id, { notes: "second pending edit" }); resume.release(); await store.flush();
    expect(store.getState().tasks.some(t => t.id === task.id)).toBe(false);
    expect(store.getState().outbox.some(entry => entry.id === task.id)).toBe(false);
    expect(store.getState().lists.some(list => list.id === "other-list")).toBe(true); store.close(); other.close();
  });

  it("rereads an owed purge if another refresh advances the cursor during deferred reconciliation", async () => {
    const pending = barrier(); const resumeWrite = barrier(); const captured = barrier(); const resumeRead = barrier();
    class Paused extends IdbPersistence {
      pauseWrite = false; pauseRead = true;
      override async apply(...args: Parameters<IdbPersistence["apply"]>) { if (this.pauseWrite) { this.pauseWrite = false; pending.release(); await resumeWrite.promise; } return super.apply(...args); }
      override async read(...args: Parameters<IdbPersistence["read"]>) { const result = await super.read(...args); if (this.pauseRead) { this.pauseRead = false; captured.release(); await resumeRead.promise; } return result; }
    }
    const p = new Paused(); const store = new LocalStore({ persistence: p, now: clock }); await store.ready;
    const task = store.addTask({ title: "pending" }); await store.flush(); p.pauseWrite = true; store.updateTask(task.id, { notes: "queued" }); await pending.promise;
    const other = new IdbPersistence(); await other.apply({ at, patches: [{ type: "task", id: task.id, op: "purge", key: "purge" }] });
    const changed = vi.fn(); store.subscribe(changed); Channel.deliver([{ type: "task", id: task.id }]); await vi.waitFor(() => expect(changed).toHaveBeenCalled());
    resumeWrite.release(); await captured.promise;
    await other.apply({ at, patches: [{ type: "list", id: "later", op: "create", key: "later", record: { id: "later", name: "Later", colour: "c1", isInbox: false } }] });
    Channel.deliver([{ type: "list", id: "later" }]); await vi.waitFor(() => expect(store.getState().lists.some(list => list.id === "later")).toBe(true));
    resumeRead.release(); await store.flush(); expect(store.getState().tasks.some(t => t.id === task.id)).toBe(false); expect(store.getState().outbox.some(entry => entry.id === task.id)).toBe(false); store.close(); other.close();
  });

  it("keeps a newer successful edit when the deferred observation was an older acknowledgement", async () => {
    const pause = barrier(); const resume = barrier();
    class Paused extends IdbPersistence { paused = false; override async apply(...args: Parameters<IdbPersistence["apply"]>) { if (this.paused) { this.paused = false; pause.release(); await resume.promise; } return super.apply(...args); } }
    const p = new Paused(); const store = new LocalStore({ persistence: p, now: clock }); await store.ready;
    const task = store.addTask({ title: "editable" }); await store.flush(); const previous = store.getState().outbox.find(entry => entry.id === task.id)!;
    p.paused = true; store.updateTask(task.id, { notes: "must survive" }); await pause.promise;
    const other = new IdbPersistence(); await other.acknowledge([{ type: "task", id: task.id, idempotencyKey: previous.idempotencyKey }]);
    const changed = vi.fn(); store.subscribe(changed); Channel.deliver([{ type: "task", id: task.id }]); await vi.waitFor(() => expect(changed).toHaveBeenCalled());
    expect(store.getState().tasks.find(t => t.id === task.id)?.notes).toBe("must survive");
    resume.release(); await store.flush();
    expect(store.getState().tasks.find(t => t.id === task.id)?.notes).toBe("must survive");
    expect(store.getState().outbox.find(entry => entry.id === task.id)?.changedFields.notes).toBe("must survive"); store.close(); other.close();
  });
});
