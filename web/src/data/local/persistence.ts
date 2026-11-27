import { coalesce, refKey, type AnyRecord, type PatchBatch, type Ref } from "../../core/planner/outbox";
import type { Acknowledged, CalendarEvent, OutboxEntry, PlannerCalendar, Project, RecordType, Tag, Task, TaskList } from "../../core/planner/types";

export interface CoveredTaskGuard { id: string }
export interface DatabaseStamp { generation: string; revision: number }
export interface InitialView {
  kind: "today" | "tasks" | "calendar" | "all";
  start: string;
  end: string;
  /** ISO instant at the start of the local week, for completion counts. */
  completedSince: string;
}
/** The database identity is valid, but retained journal history no longer covers the reader. */
export class JournalHistoryGap extends Error {
  constructor() { super("Planner changes could not be reconciled. Reload to try again."); this.name = "JournalHistoryGap"; }
}
export class StaleOperation extends Error {
  constructor() { super("Planner changed in another tab. Try that action again."); this.name = "StaleOperation"; }
}
export interface Snapshot {
  stamp?: DatabaseStamp;
  tasks: Task[];
  lists: TaskList[];
  events: CalendarEvent[];
  calendars: PlannerCalendar[];
  projects: Project[];
  tags: Tag[];
  /** Ids of tags that were purged (deleted for good): tasks that still carry one clear it the next time they are edited. */
  purgedTags: string[];
  outbox: OutboxEntry[];
}

/** The records a write or a read touched, as they now are in storage, and their outbox entries. */
export interface ApplyResult {
  before?: DatabaseStamp;
  stamp?: DatabaseStamp;
  purgedTags?: string[];
  /** `record` is null for a record that is gone. */
  records: { type: RecordType; id: string; record: AnyRecord | null }[];
  outbox: { type: RecordType; id: string; entry: OutboxEntry | null }[];
}

export interface PersistenceHandlers {
  /** Another tab wants to upgrade the database; this connection has been closed. */
  onVersionChange?: () => void;
  /** An upgrade is waiting for other tabs to close their connections. */
  onBlocked?: () => void;
}

export interface Persistence {
  /** False when nothing outlives this visit. */
  readonly durable: boolean;
  load(): Promise<Snapshot>;
  /**
   * Applies patches as patches: in one transaction each record is read, only the changed fields are
   * written, and its outbox entry is folded in. Nothing here relies on this tab's copy being current.
   */
  apply(batch: PatchBatch, expected?: DatabaseStamp, covered?: CoveredTaskGuard[]): Promise<ApplyResult>;
  /** Indexed first view, then bounded scans; optional for legacy/test adapters. */
  bootstrap?(view: InitialView): Promise<Snapshot>;
  scan?(type: RecordType, after?: string, limit?: number): Promise<{ records: ApplyResult["records"]; last?: string; done: boolean; stamp?: DatabaseStamp }>;
  changes?(since: DatabaseStamp): Promise<ApplyResult>;
  scanOutbox?(after?: number, limit?: number): Promise<{ entries: OutboxEntry[]; last?: number; done: boolean; stamp?: DatabaseStamp }>;
  /** The current state of some records, after another tab changed them. */
  read(refs: Ref[]): Promise<ApplyResult>;
  /**
   * Clears outbox entries the server has acknowledged. An entry edited since it was sent has a new
   * idempotency key and stays, so a change made while an upload was out is never lost.
   */
  acknowledge(sent: Acknowledged[]): Promise<ApplyResult>;
  setHandlers(handlers: PersistenceHandlers): void;
  /** Lets go of the storage connection (none to let go of in memory). */
  close?(): void;
}

const STORE_OF: Record<RecordType, "tasks" | "lists" | "events" | "calendars" | "projects" | "tags"> = { task: "tasks", list: "lists", event: "events", calendar: "calendars", project: "projects", tag: "tags" };
const storeOf = (type: RecordType) => STORE_OF[type];

/** Keeps everything in memory. Used where IndexedDB does not exist, and in tests. */
export class MemoryPersistence implements Persistence {
  private records = new Map<string, AnyRecord>();
  private outbox = new Map<string, OutboxEntry>();
  private purgedTags = new Set<string>();
  private nextSeq = 1;

  /** `volatile` marks a store that stands in for missing IndexedDB, so the app can say nothing is saved. */
  constructor(private readonly options: { volatile?: boolean } = {}) {}

  get durable(): boolean {
    return !this.options.volatile;
  }

  setHandlers(): void {}

  async load(): Promise<Snapshot> {
    const all = [...this.records.entries()];
    return {
      tasks: all.filter(([k]) => k.startsWith("task:")).map(([, v]) => v as Task),
      lists: all.filter(([k]) => k.startsWith("list:")).map(([, v]) => v as TaskList),
      events: all.filter(([k]) => k.startsWith("event:")).map(([, v]) => v as CalendarEvent),
      calendars: all.filter(([k]) => k.startsWith("calendar:")).map(([, v]) => v as PlannerCalendar),
      projects: all.filter(([k]) => k.startsWith("project:")).map(([, v]) => v as Project),
      tags: all.filter(([k]) => k.startsWith("tag:")).map(([, v]) => v as Tag),
      purgedTags: [...this.purgedTags],
      outbox: [...this.outbox.values()].sort((a, b) => a.seq - b.seq),
    };
  }

  async apply(batch: PatchBatch): Promise<ApplyResult> {
    const result: ApplyResult = { records: [], outbox: [] };
    for (const p of batch.patches) {
      const key = refKey(p);
      let record: AnyRecord | null = this.records.get(key) ?? null;
      if (p.op === "create") {
        if (record) {
          result.records.push({ type: p.type, id: p.id, record });
          continue; // already there, perhaps from another tab: leave it
        }
        record = p.record;
        this.records.set(key, record);
      } else if (p.op === "purge") {
        this.records.delete(key);
        if (p.type === "tag") this.purgedTags.add(p.id);
        record = null;
      } else {
        if (!record) continue;
        record = { ...record, ...p.fields } as AnyRecord;
        this.records.set(key, record);
      }
      result.records.push({ type: p.type, id: p.id, record });

      if (p.local) continue;
      const existing = this.outbox.get(key);
      const change = coalesce(existing, p, batch.at);
      if (change.remove !== undefined) this.outbox.delete(key);
      let entry: OutboxEntry | null = existing && change.remove === undefined ? existing : null;
      if (change.write) {
        entry = { ...change.write, seq: change.write.seq || this.nextSeq++ };
        this.outbox.set(key, entry);
      }
      result.outbox.push({ type: p.type, id: p.id, entry });
    }
    return result;
  }

  async acknowledge(sent: Acknowledged[]): Promise<ApplyResult> {
    const result: ApplyResult = { records: [], outbox: [] };
    for (const a of sent) {
      const key = refKey(a);
      const existing = this.outbox.get(key);
      if (existing && existing.idempotencyKey === a.idempotencyKey) this.outbox.delete(key);
      result.outbox.push({ type: a.type, id: a.id, entry: this.outbox.get(key) ?? null });
    }
    return result;
  }

  async read(refs: Ref[]): Promise<ApplyResult> {
    return {
      records: refs.map((r) => ({ ...r, record: this.records.get(refKey(r)) ?? null })),
      outbox: refs.map((r) => ({ ...r, entry: this.outbox.get(refKey(r)) ?? null })),
    };
  }
}

/** The planner kept on this device alone; each account has a database of its own (see `planners.ts`). */
export const DEVICE_DB = "orbyn-planner";
export const PLANNER_DB_VERSION = 8;

type Rec = AnyRecord & Record<string, unknown>;
const JOURNAL_LIMIT = 4096;
const RECORD_TYPES: RecordType[] = ["task", "list", "event", "calendar", "project", "tag"];
const emptySnapshot = (): Snapshot => ({ tasks: [], lists: [], events: [], calendars: [], projects: [], tags: [], purgedTags: [], outbox: [] });
const sameStamp = (a: DatabaseStamp, b: DatabaseStamp) => a.generation === b.generation && a.revision === b.revision;
interface JournalEntry { revision: number; refs: Ref[] }
/** Additive projections: source records and generated wire shapes stay untouched. */
function project(type: RecordType, value: AnyRecord): Record<string, unknown> {
  const r = value as Rec;
  if (type === "task") return { id: r.id, due: !r.deletedAt && !r.done && typeof r.due === "string" ? r.due : undefined, status: r.deletedAt ? "deleted" : r.done ? "done" : "open", completed: typeof r.completedAt === "string" && Number.isFinite(Date.parse(r.completedAt)) ? new Date(r.completedAt).toISOString() : "", recurring: r.repeat && !r.deletedAt ? "yes" : "no" };
  return { id: r.id, start: !r.deletedAt ? r.start : undefined, end: !r.deletedAt ? r.end : undefined, conservative: !r.deletedAt && (r.repeat || r.zone) ? "yes" : "no" };
}
function updateProjection(tx: IDBTransaction, type: RecordType, id: string, record: AnyRecord | null): void {
  if (type !== "task" && type !== "event") return;
  const index = tx.objectStore(type + "Index");
  if (record) index.put(project(type, record)); else index.delete(id);
}
function writeJournal(tx: IDBTransaction, stamp: DatabaseStamp, refs: Ref[]): DatabaseStamp {
  const next = { ...stamp, revision: stamp.revision + 1 };
  tx.objectStore("meta").put(next, "stamp");
  const journal = tx.objectStore("journal");
  journal.put({ revision: next.revision, refs: [...new Map(refs.map(({ type, id }) => [refKey({ type, id }), { type, id }])).values()] } satisfies JournalEntry);
  if (next.revision > JOURNAL_LIMIT) journal.delete(IDBKeyRange.upperBound(next.revision - JOURNAL_LIMIT));
  return next;
}
const ALL_STORES = ["tasks", "lists", "events", "calendars", "projects", "tags", "purgedTags", "outbox", "meta", "journal", "taskIndex", "eventIndex"];

/** One IndexedDB object store per record type, and an outbox keyed by an auto-incrementing number. */
export class IdbPersistence implements Persistence {
  readonly durable = true;

  constructor(private readonly dbName: string = DEVICE_DB) {}

  private db: Promise<IDBDatabase> | null = null;
  private handlers: PersistenceHandlers = {};

  setHandlers(handlers: PersistenceHandlers): void {
    this.handlers = handlers;
  }

  /** Lets go of the connection, so the database can be deleted. */
  close(): void {
    const pending = this.db;
    this.db = null;
    void pending?.then((db) => db.close(), () => undefined);
  }

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, PLANNER_DB_VERSION);
      req.onupgradeneeded = (event) => {
        const db = req.result;
        for (const name of ["tasks", "lists", "events", "calendars", "projects", "tags"]) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
        }
        const tx = req.transaction!;
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta").put({ generation: crypto.randomUUID(), revision: 0 } satisfies DatabaseStamp, "stamp");
          db.createObjectStore("journal", { keyPath: "revision" });
        }
        if (event.oldVersion === 7) {
          // Version 7 accidentally persisted ApplyResult objects as refs. Strip historical record/
          // outbox payloads atomically; keep every source record, revision and journal reference.
          tx.objectStore("journal").openCursor().onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (!cursor) return;
            const entry = cursor.value as JournalEntry;
            cursor.update({ revision: entry.revision, refs: entry.refs.map(({ type, id }) => ({ type, id })) } satisfies JournalEntry);
            cursor.continue();
          };
        }
        for (const [type, names] of [["task", ["due", "status", "completed", "recurring"]], ["event", ["start", "end", "conservative"]]] as const) {
          const name = type + "Index";
          if (!db.objectStoreNames.contains(name)) {
            const projection = db.createObjectStore(name, { keyPath: "id" });
            for (const key of names) projection.createIndex(key, key);
            // The versionchange transaction atomically backfills projections, never source records.
            tx.objectStore(storeOf(type)).openCursor().onsuccess = (event) => {
              const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
              if (cursor) { projection.put(project(type, cursor.value as AnyRecord)); cursor.continue(); }
            };
          }
        }
        // Ids of purged tags, the key being the id.
        if (!db.objectStoreNames.contains("purgedTags")) db.createObjectStore("purgedTags");
        // Version 1 keyed the outbox by a number made in memory, which two tabs would reuse.
        if (event.oldVersion > 0 && event.oldVersion < 2 && db.objectStoreNames.contains("outbox")) db.deleteObjectStore("outbox");
        if (!db.objectStoreNames.contains("outbox")) {
          const outbox = db.createObjectStore("outbox", { keyPath: "seq", autoIncrement: true });
          outbox.createIndex("record", ["type", "id"], { unique: true });
        }
      };
      req.onblocked = () => this.handlers.onBlocked?.();
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          this.db = null;
          this.handlers.onVersionChange?.();
        };
        resolve(db);
      };
      req.onerror = () => {
        this.db = null;
        reject(req.error);
      };
    });
    return this.db;
  }

  async load(): Promise<Snapshot> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ALL_STORES, "readonly");
      const out = emptySnapshot();
      tx.objectStore("meta").get("stamp").onsuccess = (e) => { out.stamp = (e.target as IDBRequest<DatabaseStamp>).result; };
      tx.objectStore("tasks").getAll().onsuccess = (e) => (out.tasks = (e.target as IDBRequest<Task[]>).result);
      tx.objectStore("lists").getAll().onsuccess = (e) => (out.lists = (e.target as IDBRequest<TaskList[]>).result);
      tx.objectStore("events").getAll().onsuccess = (e) => (out.events = (e.target as IDBRequest<CalendarEvent[]>).result);
      tx.objectStore("calendars").getAll().onsuccess = (e) => (out.calendars = (e.target as IDBRequest<PlannerCalendar[]>).result);
      tx.objectStore("projects").getAll().onsuccess = (e) => (out.projects = (e.target as IDBRequest<Project[]>).result);
      tx.objectStore("tags").getAll().onsuccess = (e) => (out.tags = (e.target as IDBRequest<Tag[]>).result);
      tx.objectStore("purgedTags").getAllKeys().onsuccess = (e) => (out.purgedTags = (e.target as IDBRequest<IDBValidKey[]>).result.map(String));
      tx.objectStore("outbox").getAll().onsuccess = (e) => (out.outbox = (e.target as IDBRequest<OutboxEntry[]>).result.sort((a, b) => a.seq - b.seq));
      tx.oncomplete = () => resolve(out);
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("The read was aborted"));
    });
  }

  async bootstrap(view: InitialView): Promise<Snapshot> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ALL_STORES, "readonly");
      const out = emptySnapshot();
      tx.objectStore("meta").get("stamp").onsuccess = (e) => { out.stamp = (e.target as IDBRequest<DatabaseStamp>).result; };
      for (const type of RECORD_TYPES.filter(t => t !== "task" && t !== "event")) {
        tx.objectStore(storeOf(type)).getAll().onsuccess = (e) => {
          (out[storeOf(type)] as AnyRecord[]) = (e.target as IDBRequest<AnyRecord[]>).result;
        };
      }
      tx.objectStore("purgedTags").getAllKeys().onsuccess = (e) => { out.purgedTags = (e.target as IDBRequest<IDBValidKey[]>).result.map(String); };
      const selected = new Set<string>();
      const readSelected = (type: "task" | "event", ids: IDBValidKey[], predicate?: (r: Rec) => boolean) => {
        for (const id of ids) {
          const key = `${type}:${String(id)}`;
          if (selected.has(key)) continue;
          tx.objectStore(storeOf(type)).get(id).onsuccess = (event) => {
            const record = (event.target as IDBRequest<Rec | undefined>).result;
            if (record && !selected.has(key) && (!predicate || predicate(record))) { selected.add(key); (out[storeOf(type)] as AnyRecord[]).push(record); }
          };
        }
      };
      const select = (type: "task" | "event", index: string, range: IDBValidKey | IDBKeyRange, predicate?: (r: Rec) => boolean) => {
        tx.objectStore(type + "Index").index(index).getAllKeys(range).onsuccess = (e) => readSelected(type, (e.target as IDBRequest<IDBValidKey[]>).result, predicate);
      };
      if (view.kind === "today") {
        select("task", "due", IDBKeyRange.upperBound(view.end + "\uffff"), r => typeof r.due === "string" && r.deletedAt === null && !r.done);
        select("task", "completed", IDBKeyRange.lowerBound(view.completedSince));
        select("task", "recurring", "yes");
      } else if (view.kind === "tasks") {
        select("task", "status", "open");
        // Tasks deliberately retains tasks completed today in place. The supplied week start is a
        // conservative superset of local day start; the view's existing selector determines visibility.
        select("task", "completed", IDBKeyRange.lowerBound(view.completedSince));
      }
      if (view.kind === "today" || view.kind === "calendar") {
        // Intersect cheap index keys before reading source records: end>=start alone includes every
        // far-future event, while start<=end alone includes the whole past feed history.
        let starts: IDBValidKey[] | undefined;
        let ends: IDBValidKey[] | undefined;
        const intersect = () => {
          if (!starts || !ends) return;
          const inRange = new Set(starts);
          readSelected("event", ends.filter(id => inRange.has(id)));
        };
        tx.objectStore("eventIndex").index("start").getAllKeys(IDBKeyRange.upperBound(view.end + "\uffff")).onsuccess = (e) => { starts = (e.target as IDBRequest<IDBValidKey[]>).result; intersect(); };
        tx.objectStore("eventIndex").index("end").getAllKeys(IDBKeyRange.lowerBound(view.start)).onsuccess = (e) => { ends = (e.target as IDBRequest<IDBValidKey[]>).result; intersect(); };
        // Recurrence masters can start years outside the window. Time-zone events get conservative treatment too.
        select("event", "conservative", "yes");
      }
      tx.oncomplete = () => resolve(out);
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("The first view could not be read"));
    });
  }

  async scan(type: RecordType, after?: string, limit = 256): Promise<{ records: ApplyResult["records"]; last?: string; done: boolean; stamp?: DatabaseStamp }> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([storeOf(type), "meta"], "readonly");
      let records: AnyRecord[] = [];
      let stamp: DatabaseStamp;
      tx.objectStore("meta").get("stamp").onsuccess = (e) => { stamp = (e.target as IDBRequest<DatabaseStamp>).result; };
      tx.objectStore(storeOf(type)).getAll(after === undefined ? undefined : IDBKeyRange.lowerBound(after, true), limit).onsuccess = (e) => { records = (e.target as IDBRequest<AnyRecord[]>).result; };
      tx.oncomplete = () => resolve({ records: records.map(record => ({ type, id: record.id, record })), last: records.at(-1)?.id, done: records.length < limit, stamp });
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("The background read was aborted"));
    });
  }

  async scanOutbox(after?: number, limit = 256): Promise<{ entries: OutboxEntry[]; last?: number; done: boolean; stamp?: DatabaseStamp }> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["outbox", "meta"], "readonly");
      let entries: OutboxEntry[] = [];
      let stamp: DatabaseStamp;
      tx.objectStore("meta").get("stamp").onsuccess = (e) => { stamp = (e.target as IDBRequest<DatabaseStamp>).result; };
      tx.objectStore("outbox").getAll(after === undefined ? undefined : IDBKeyRange.lowerBound(after, true), limit).onsuccess = (e) => { entries = (e.target as IDBRequest<OutboxEntry[]>).result; };
      tx.oncomplete = () => resolve({ entries, last: entries.at(-1)?.seq, done: entries.length < limit, stamp });
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("The pending changes could not be read"));
    });
  }

  async changes(since: DatabaseStamp): Promise<ApplyResult> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ALL_STORES, "readonly");
      const result: ApplyResult = { records: [], outbox: [] };
      let failure: Error | null = null;
      tx.objectStore("meta").get("stamp").onsuccess = (event) => {
        const stamp = (event.target as IDBRequest<DatabaseStamp>).result;
        if (stamp.generation !== since.generation || stamp.revision < since.revision) {
          failure = new Error("The planner database changed while it was loading. Reload to try again."); tx.abort(); return;
        }
        result.stamp = stamp;
        tx.objectStore("journal").getAll(IDBKeyRange.lowerBound(since.revision, true)).onsuccess = (e) => {
          const entries = (e.target as IDBRequest<JournalEntry[]>).result;
          if (entries.length !== stamp.revision - since.revision || entries.some((x, i) => x.revision !== since.revision + i + 1)) {
            failure = new JournalHistoryGap(); tx.abort(); return;
          }
          const refs = new Map(entries.flatMap(entry => entry.refs).map(({ type, id }) => [refKey({ type, id }), { type, id }]));
          for (const r of refs.values()) {
            tx.objectStore(storeOf(r.type)).get(r.id).onsuccess = (e) => result.records.push({ ...r, record: (e.target as IDBRequest<AnyRecord | undefined>).result ?? null });
            tx.objectStore("outbox").index("record").get([r.type, r.id]).onsuccess = (e) => result.outbox.push({ ...r, entry: (e.target as IDBRequest<OutboxEntry | undefined>).result ?? null });
          }
        };
      };
      tx.objectStore("purgedTags").getAllKeys().onsuccess = (e) => { result.purgedTags = (e.target as IDBRequest<IDBValidKey[]>).result.map(String); };
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(failure ?? tx.error ?? new Error("The planner changes could not be read"));
    });
  }

  async apply(batch: PatchBatch, expected?: DatabaseStamp, covered?: CoveredTaskGuard[]): Promise<ApplyResult> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ALL_STORES, "readwrite");
      const result: ApplyResult = { records: [], outbox: [] };
      let failure: Error | null = null;
      let stamp: DatabaseStamp;
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(failure ?? tx.error ?? new Error("The write was aborted"));
      const outbox = tx.objectStore("outbox");
      const byRecord = outbox.index("record");

      // Callback style on purpose: every request is issued from the previous one's success handler,
      // so the transaction never sits idle between steps.
      const run = (i: number): void => {
        const p = batch.patches[i];
        if (!p) {
          if (result.records.length || result.outbox.length) result.stamp = writeJournal(tx, stamp, [...result.records, ...result.outbox]);
          else result.stamp = stamp;
          return;
        }
        const store = tx.objectStore(storeOf(p.type));

        const foldOutbox = (record: AnyRecord | null) => {
          updateProjection(tx, p.type, p.id, record);
          result.records.push({ type: p.type, id: p.id, record });
          if (p.local) return run(i + 1);
          byRecord.get([p.type, p.id]).onsuccess = (e) => {
            const existing = (e.target as IDBRequest<OutboxEntry | undefined>).result;
            const change = coalesce(existing, p, batch.at);
            if (change.remove !== undefined) outbox.delete(change.remove);
            let entry: OutboxEntry | null = existing && change.remove === undefined ? existing : null;
            const done = () => {
              result.outbox.push({ type: p.type, id: p.id, entry });
              run(i + 1);
            };
            const write = change.write;
            if (!write) return done();
            if (write.seq > 0) {
              entry = write;
              outbox.put(write).onsuccess = done;
            } else {
              const { seq: _unused, ...body } = write;
              void _unused;
              outbox.add(body).onsuccess = (ev) => {
                entry = { ...write, seq: (ev.target as IDBRequest<number>).result };
                done();
              };
            }
          };
        };

        if (p.op === "create") {
          store.get(p.id).onsuccess = (e) => {
            const current = (e.target as IDBRequest<AnyRecord | undefined>).result;
            if (current) {
              // Already there, perhaps made by another tab: leave it alone.
              result.records.push({ type: p.type, id: p.id, record: current });
              return run(i + 1);
            }
            store.put(p.record).onsuccess = () => foldOutbox(p.record);
          };
        } else if (p.op === "purge") {
          store.delete(p.id).onsuccess = () => {
            if (p.type === "tag") tx.objectStore("purgedTags").put(true, p.id);
            foldOutbox(null);
          };
        } else {
          store.get(p.id).onsuccess = (e) => {
            const current = (e.target as IDBRequest<Rec | undefined>).result;
            if (!current) return run(i + 1); // purged elsewhere
            const next = { ...current, ...p.fields } as Rec;
            store.put(next).onsuccess = () => foldOutbox(next);
          };
        }
      };
      tx.objectStore("meta").get("stamp").onsuccess = (e) => {
        stamp = (e.target as IDBRequest<DatabaseStamp>).result;
        result.before = stamp;
        if (expected && !sameStamp(expected, stamp)) { failure = new StaleOperation(); tx.abort(); return; }
        const check = (i: number): void => {
          const guard = covered?.[i];
          if (!guard) { run(0); return; }
          tx.objectStore("tasks").get(guard.id).onsuccess = (event) => {
            const task = (event.target as IDBRequest<Task | undefined>).result;
            if (!task || task.repeat || task.overrideOf || task.deletedAt) { failure = new StaleOperation(); tx.abort(); return; }
            check(i + 1);
          };
        };
        check(0);
      };
    });
  }

  async acknowledge(sent: Acknowledged[]): Promise<ApplyResult> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["outbox", "meta", "journal"], "readwrite");
      const result: ApplyResult = { records: [], outbox: [] };
      const outbox = tx.objectStore("outbox");
      tx.objectStore("meta").get("stamp").onsuccess = (e) => {
        const stamp = (e.target as IDBRequest<DatabaseStamp>).result;
        result.stamp = sent.length ? writeJournal(tx, stamp, sent) : stamp;
      };
      for (const a of sent) {
        outbox.index("record").get([a.type, a.id]).onsuccess = (e) => {
          const existing = (e.target as IDBRequest<OutboxEntry | undefined>).result;
          if (existing && existing.idempotencyKey === a.idempotencyKey) {
            outbox.delete(existing.seq);
            result.outbox.push({ type: a.type, id: a.id, entry: null });
          } else {
            result.outbox.push({ type: a.type, id: a.id, entry: existing ?? null });
          }
        };
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("The write was aborted"));
    });
  }

  async read(refs: Ref[]): Promise<ApplyResult> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ALL_STORES, "readonly");
      const result: ApplyResult = { records: [], outbox: [] };
      tx.objectStore("meta").get("stamp").onsuccess = (e) => { result.stamp = (e.target as IDBRequest<DatabaseStamp>).result; };
      tx.objectStore("purgedTags").getAllKeys().onsuccess = (e) => { result.purgedTags = (e.target as IDBRequest<IDBValidKey[]>).result.map(String); };
      for (const r of refs) {
        tx.objectStore(storeOf(r.type)).get(r.id).onsuccess = (e) =>
          result.records.push({ ...r, record: (e.target as IDBRequest<AnyRecord | undefined>).result ?? null });
        tx.objectStore("outbox").index("record").get([r.type, r.id]).onsuccess = (e) =>
          result.outbox.push({ ...r, entry: (e.target as IDBRequest<OutboxEntry | undefined>).result ?? null });
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("The read was aborted"));
    });
  }
}

/** IndexedDB where it exists, else memory that says so. */
export function defaultPersistence(dbName: string = DEVICE_DB): Persistence {
  return typeof indexedDB === "undefined" ? new MemoryPersistence({ volatile: true }) : new IdbPersistence(dbName);
}
