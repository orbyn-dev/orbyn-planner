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

describe("post-commit reconciliation failures", () => {
  it.each([false, true])("retries an owed read without failing a committed write (remote=%s)", async (remote) => {
    const committed = barrier(); const resume = barrier();
    class Paused extends IdbPersistence {
      pause = false;
      override async apply(...args: Parameters<IdbPersistence["apply"]>) {
        const result = await super.apply(...args);
        if (this.pause) { this.pause = false; committed.release(); await resume.promise; }
        return result;
      }
    }
    const p = new Paused(); const store = new LocalStore({ persistence: p, now: clock }); await store.ready;
    const task = store.addTask({ title: "before" }); await store.flush(); const prepared = await store.prepareSync();
    p.pause = true;
    let operation: Promise<void>;
    if (remote) operation = store.applyRemote([{ type: "task", id: task.id, fields: { notes: "committed edit" } }], prepared);
    else { store.updateTask(task.id, { notes: "committed edit" }); operation = store.flush(); }
    await committed.promise;
    const other = new IdbPersistence(); await other.apply({ at, patches: [{ type: "task", id: task.id, op: "update", key: "newer", fields: { title: "newer external title" } }] });
    const changed = vi.fn(); store.subscribe(changed); Channel.deliver([{ type: "task", id: task.id }]); await vi.waitFor(() => expect(changed).toHaveBeenCalled());
    const read = vi.spyOn(p, "read").mockRejectedValueOnce(new Error("temporary follow-up read failure"));
    resume.release(); const outcome = await operation.then(() => null, error => error);
    expect((await other.load()).tasks.find(t => t.id === task.id)).toMatchObject({ notes: "committed edit", title: "newer external title" });
    expect(outcome).toBeNull();
    read.mockRejectedValueOnce(new Error("read still unavailable"));
    await expect(store.prepareSync()).rejects.toThrow("read still unavailable");
    expect(store.getState().persistence.status).toBe("ok");
    expect((await store.prepareSync()).tasks.find(t => t.id === task.id)).toMatchObject({ notes: "committed edit", title: "newer external title" });
    expect(read).toHaveBeenCalledTimes(3); expect(store.getState().persistence.status).toBe("ok"); store.close(); other.close();
  });

  it("keeps genuine write failures blocked and preserves their unsaved optimistic edits", async () => {
    const p = new IdbPersistence(); const store = new LocalStore({ persistence: p, now: clock, broadcast: false }); await store.ready;
    const task = store.addTask({ title: "saved" }); await store.flush();
    vi.spyOn(p, "apply").mockRejectedValueOnce(new DOMException("full", "QuotaExceededError"));
    store.updateTask(task.id, { title: "unsaved" }); await store.flush();
    await expect(store.prepareSync()).rejects.toThrow("not ready to sync");
    expect(store.getState().persistence).toEqual({ status: "failed", reason: "This device is out of storage." });
    expect(store.getState().tasks.find(t => t.id === task.id)?.title).toBe("unsaved");
    expect((await p.load()).tasks.find(t => t.id === task.id)?.title).toBe("saved"); store.close();
  });
});

describe("complete-view certification", () => {
  it.each([[false, false], [true, false], [false, true]])("certifies metadata before checking a name (queued early=%s, reuse old=%s)", async (queuedEarly, reuseOld) => {
    const committed = barrier(); const resume = barrier();
    class Paused extends IdbPersistence {
      pause = false;
      override async apply(...args: Parameters<IdbPersistence["apply"]>) { const result = await super.apply(...args); if (this.pause) { this.pause = false; committed.release(); await resume.promise; } return result; }
    }
    const p = new Paused(); const store = new LocalStore({ persistence: p, now: clock }); await store.ready;
    const tag = store.addTag("Original", "c1"); const task = store.addTask({ title: "ordinary" }); await store.flush();
    p.pause = true; store.updateTag(tag.id, { colour: "c2" }); const colourDone = store.flush(); await committed.promise;
    const renamed = "Renamed elsewhere";
    if (queuedEarly) store.addTag(renamed, "c3");
    const other = new IdbPersistence(); await other.apply({ at, patches: [{ type: "tag", id: tag.id, op: "update", key: "rename", fields: { name: renamed } }] });
    const changed = vi.fn(); store.subscribe(changed); Channel.deliver([{ type: "tag", id: tag.id }]); await vi.waitFor(() => expect(changed).toHaveBeenCalled());
    vi.spyOn(p, "read").mockRejectedValueOnce(new Error("metadata read unavailable")); resume.release(); await colourDone;
    expect((await other.load()).tags.find(t => t.id === tag.id)).toMatchObject({ name: renamed, colour: "c2" });
    let returned: unknown; let rejected: unknown;
    if (!queuedEarly) {
      store.updateTask(task.id, { notes: "ordinary writes remain allowed" }); await store.flush();
      expect((await other.load()).tasks.find(t => t.id === task.id)?.notes).toBe("ordinary writes remain allowed");
      try { returned = store.addTag(reuseOld ? "Original" : renamed, "c3"); } catch (error) { rejected = error; }
    }
    await store.flush();
    expect((await other.load()).tags.filter(t => t.name === renamed)).toHaveLength(1);
    if (!queuedEarly) { expect(returned).toBeUndefined(); expect(rejected).toMatchObject({ name: "StaleOperation" }); }
    if (reuseOld) {
      const reused = store.addTag("Original", "c3"); await store.flush();
      expect((await other.load()).tags.some(t => t.id === reused.id && t.name === "Original")).toBe(true);
    }
    // An authoritative recovery empties the owed refs. A cached previous read error must not
    // permanently block a legitimate complete operation, including in the local-only planner.
    const retry = store.addTag("Unique retry", "c4"); await store.flush();
    expect((await other.load()).tags.some(t => t.id === retry.id && t.name === "Unique retry")).toBe(true);
    expect(store.getState().persistence.status).toBe("ok"); store.close(); other.close();
  });

  it("does not certify a view while its owed read is in flight, even after its ref left the queue", async () => {
    const committed = barrier(); const resumeApply = barrier(); const capturedRead = barrier(); const resumeRead = barrier();
    class Paused extends IdbPersistence {
      pauseApply = false; pauseRead = false;
      override async apply(...args: Parameters<IdbPersistence["apply"]>) { const result = await super.apply(...args); if (this.pauseApply) { this.pauseApply = false; committed.release(); await resumeApply.promise; } return result; }
      override async read(...args: Parameters<IdbPersistence["read"]>) { const result = await super.read(...args); if (this.pauseRead) { this.pauseRead = false; capturedRead.release(); await resumeRead.promise; } return result; }
    }
    const p = new Paused(); const store = new LocalStore({ persistence: p, now: clock }); await store.ready;
    const tag = store.addTag("Original", "c1"); await store.flush(); p.pauseApply = true; store.updateTag(tag.id, { colour: "c2" }); await committed.promise;
    const other = new IdbPersistence(); await other.apply({ at, patches: [{ type: "tag", id: tag.id, op: "update", key: "rename", fields: { name: "New name" } }] });
    const changed = vi.fn(); store.subscribe(changed); Channel.deliver([{ type: "tag", id: tag.id }]); await vi.waitFor(() => expect(changed).toHaveBeenCalled());
    p.pauseRead = true; resumeApply.release(); await capturedRead.promise;
    let returned: unknown; let rejected: unknown;
    try { returned = store.addTag("New name", "c3"); } catch (error) { rejected = error; }
    resumeRead.release(); await store.flush();
    expect((await other.load()).tags.filter(t => t.name === "New name")).toHaveLength(1);
    expect(returned).toBeUndefined(); expect(rejected).toMatchObject({ name: "StaleOperation" });
    store.addTag("After read", "c4"); await store.flush(); expect(store.getState().persistence.status).toBe("ok"); store.close(); other.close();
  });
});
