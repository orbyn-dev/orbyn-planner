import { repeatFields } from "../../core/planner/eventRecord";
import { applyFields, sectionFields, storedOf, TAG_PREFIX, viewOf } from "../../core/planner/records";
import { coalesce, refKey, type AnyRecord, type Patch, type Ref } from "../../core/planner/outbox";
import { DEVICE_DB, defaultPersistence, StaleOperation, type ApplyResult, type DatabaseStamp, type InitialView, type Snapshot, type Persistence } from "./persistence";
import { type Acknowledged } from "../../core/planner/types";
import { addDays, dateKey, startOfWeek } from "../../core/planner/dates";
import { inOrder, keyBetween } from "../../core/planner/order";
import { newSeries, validate } from "../../core/planner/repeat";
import { completeRepeating } from "../../core/planner/taskRepeat";
import {
  DuplicateTagName,
  RESTORE_DAYS,
  type CalendarEvent,
  type CalendarPatch,
  type EventPatch,
  type FeedEvent,
  type ListColour,
  type ListPatch,
  type NewEvent,
  type NewProject,
  type NewTask,
  type PlannerCalendar,
  type Project,
  type ProjectPatch,
  type ProjectSection,
  type OutboxEntry,
  type PersistenceState,
  type PlannerState,
  type PlannerStore,
  type RecordType,
  type RemoteChange,
  type Tag,
  type TagPatch,
  type Task,
  type TaskList,
  type TaskPatch,
} from "../../core/planner/types";

/** Every tab makes the Inbox with this id, so two tabs starting together still end with one. */
export const INBOX_ID = "inbox";
/** Likewise the first calendar. */
export const PERSONAL_CALENDAR_ID = "personal";
export const CHANNEL_NAME = "orbyn-planner";
const DAY_MS = 86_400_000;
/** Stamps newer than this were made with the clock the purge is checking, so they prove nothing about it. */
const CLOCK_CHECK_MS = 60_000;
const KEY_OF = { task: "tasks", list: "lists", event: "events", calendar: "calendars", project: "projects", tag: "tags" } as const;

export interface LocalStoreOptions {
  persistence?: Persistence;
  /** Requested first view. Other routes continue to wait for full coverage. */
  initialView?: InitialView;
  /** The IndexedDB database to open when no `persistence` is given: the device-only planner by default, an account's own otherwise. */
  dbName?: string;
  now?: () => Date;
  newId?: () => string;
  /** Called when another tab upgrades the database and this one must start over. Defaults to a page reload. */
  onReload?: () => void;
  /** Tell other tabs about writes. Defaults to on where BroadcastChannel exists. */
  broadcast?: boolean;
}

type PatchInput = Patch extends infer P ? (P extends Patch ? Omit<P, "key"> : never) : never;

function describe(error: unknown, doing: "write" | "open"): string {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  if (name === "QuotaExceededError") return "This device is out of storage.";
  return doing === "open" ? "Couldn’t open this device’s storage." : "Couldn’t write to this device’s storage.";
}

export class LocalStore implements PlannerStore {
  readonly ready: Promise<void>;
  private state: PlannerState = { ready: false, coverage: { phase: "loading", metadata: false, taskRecords: "partial", eventRecords: "partial", outbox: "loading" }, tasks: [], lists: [], events: [], calendars: [], projects: [], tags: [], outbox: [], persistence: { status: "ok" } };
  private listeners = new Set<() => void>();
  private persistence: Persistence;
  private writes: Promise<void> = Promise.resolve();
  /** Failed hydration disables writes; a later write failure preserves its optimistic record. */
  private writable = true;
  private provisional = 0;
  private closed = false;
  /** Last revision for which the complete change stream is known, never advanced by a partial read. */
  private stamp?: DatabaseStamp;
  private ownRevisions = new Set<number>();
  private preparedSnapshots = new WeakMap<PlannerState, DatabaseStamp>();
  private hydrationSeen: Set<string> | null = null;
  private readonly initialView: InitialView;
  private pending = new Map<string, number>();
  /** Purged tag ids: a task that still carries one has it cleared the next time it is edited (no rewrite of the rest). */
  private purgedTags = new Set<string>();
  private channel: BroadcastChannel | null = null;
  private readonly tab = Math.random().toString(36).slice(2);
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(options: LocalStoreOptions = {}) {
    this.persistence = options.persistence ?? defaultPersistence(options.dbName);
    this.now = options.now ?? (() => new Date());
    this.newId = options.newId ?? (() => crypto.randomUUID());
    const day = this.now();
    this.initialView = options.initialView ?? { kind: "today", start: dateKey(day), end: dateKey(addDays(day, 6)), completedSince: startOfWeek(day).toISOString() };
    this.state = { ...this.state, persistence: this.persistence.durable ? { status: "ok" } : { status: "memory" } };

    const reload = options.onReload ?? (() => window.location.reload());
    this.persistence.setHandlers({
      onVersionChange: () => {
        this.closed = true;
        this.setPersistence({ status: "failed", reason: "Another tab updated Orbyn Planner. This page will reload." });
        reload();
      },
      onBlocked: () => this.setPersistence({ status: "failed", reason: "Close the other Orbyn Planner tabs to finish updating." }),
    });
    if ((options.broadcast ?? true) && typeof BroadcastChannel !== "undefined") {
      // Tabs on the same database talk; tabs on another account's database never hear this one.
      this.channel = new BroadcastChannel(options.dbName && options.dbName !== DEVICE_DB ? `${CHANNEL_NAME}:${options.dbName}` : CHANNEL_NAME);
      this.channel.onmessage = (event: MessageEvent<{ tab: string; refs: Ref[] }>) => {
        if (event.data.tab !== this.tab) void this.refresh(event.data.refs);
      };
    }
    if (typeof performance !== "undefined") performance.mark("planner:store-start");
    this.ready = this.load();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): PlannerState => this.state;

  /** Resolves once every write so far has been tried. */
  flush(): Promise<void> {
    return this.writes;
  }

  /**
   * Takes in records from another planner (the one kept on this device alone) as new local edits: they go
   * through the outbox like anything typed here, and upload with the normal keys. A record whose id is
   * already here (the Inbox, the Personal calendar, or something taken in earlier) is left as it is, so
   * taking in the same planner twice adds nothing. Returns how many records were added.
   */
  adopt(from: PlannerState): number {
    this.assertReady();
    const inputs: PatchInput[] = [];
    const add = <T extends { id: string }>(type: RecordType, records: readonly T[]) => {
      for (const record of records) if (!this.current(type, record.id)) inputs.push({ type, id: record.id, op: "create", record } as unknown as PatchInput);
    };
    // Whatever a record belongs to goes first.
    add("list", from.lists);
    add("calendar", from.calendars);
    add("project", from.projects);
    add("tag", from.tags);
    add("task", from.tasks);
    add("event", from.events);
    if (inputs.length > 0) this.commit(inputs, true);
    return inputs.length;
  }

  /** Stops listening to other tabs. */
  close(): void {
    this.closed = true;
    this.channel?.close();
    this.channel = null;
    this.persistence.close?.();
  }

  nowIso(): string {
    return this.now().toISOString();
  }

  async acknowledge(sent: Acknowledged[]): Promise<void> {
    await this.ready;
    this.assertReady();
    if (sent.length === 0) return;
    await this.flush(); // writes made so far are in storage, so the comparison below sees them
    if (this.closed) return;
    const result = await this.persistence.acknowledge(sent);
    if (this.closed) return;
    this.reconcile(result);
    this.channel?.postMessage({ tab: this.tab, refs: sent.map((s) => ({ type: s.type, id: s.id })) });
  }

  async applyRemote(changes: RemoteChange[], preparedSnapshot?: PlannerState): Promise<void> {
    this.assertReady();
    const inputs: PatchInput[] = [];
    for (const c of changes) {
      const here = this.current(c.type, c.id);
      if (c.fields === null) {
        if (here) inputs.push({ type: c.type, id: c.id, op: "purge", local: true });
      } else if (here) {
        inputs.push({ type: c.type, id: c.id, op: "update", fields: c.fields, local: true });
      } else {
        inputs.push({ type: c.type, id: c.id, op: "create", record: viewOf(c.type, { id: c.id, ...c.fields } as unknown as AnyRecord), local: true });
      }
    }
    const expected = preparedSnapshot ? this.preparedSnapshots.get(preparedSnapshot) : this.stamp;
    if (preparedSnapshot && this.stamp && !expected) throw new StaleOperation();
    if (inputs.length > 0) await this.commit(inputs, true, true, expected);
    else await this.flush();
  }

  pendingChanges(): number {
    return this.state.outbox.length;
  }

  private emit(): void {
    if (this.closed) return;
    for (const listener of this.listeners) listener();
  }

  private setPersistence(next: PersistenceState): void {
    this.state = { ...this.state, persistence: next };
    this.emit();
  }

  private assertReady(): void {
    if (this.closed || !this.state.ready) throw new Error("The store is still loading");
  }

  /** Replace a full snapshot, retaining unchanged identities and writes which have not committed yet. */
  private install(snapshot: Snapshot): void {
    this.purgedTags = new Set(snapshot.purgedTags);
    const keys = ["tasks", "lists", "events", "calendars", "projects", "tags"] as const;
    const types = ["task", "list", "event", "calendar", "project", "tag"] as const;
    for (const [i, key] of keys.entries()) {
      const type = types[i]!;
      const previous = this.state[key] as readonly AnyRecord[];
      const sources = new Map<string, AnyRecord>(snapshot[key].map(record => [record.id, record]));
      const records: AnyRecord[] = [];
      for (const old of previous) {
        const raw = sources.get(old.id);
        if (this.pending.get(refKey({ type, id: old.id }))) records.push(old);
        else if (raw) {
          const next = viewOf(type, raw);
          records.push(JSON.stringify(old) === JSON.stringify(next) ? old : next);
        }
        sources.delete(old.id);
      }
      // Existing records keep their logical order; newly discovered ids append. A pending local
      // absence (purge) must not be resurrected by a read which predates its commit.
      for (const raw of sources.values()) if (!this.pending.get(refKey({ type, id: raw.id }))) records.push(viewOf(type, raw));
      if (records.length !== previous.length || records.some((r, index) => r !== previous[index])) this.state = { ...this.state, [key]: records };
    }
    const sources = new Map(snapshot.outbox.map(entry => [refKey(entry), entry]));
    const outbox: OutboxEntry[] = [];
    for (const old of this.state.outbox) {
      const key = refKey(old);
      const next = sources.get(key);
      if (this.pending.get(key)) outbox.push(old);
      else if (next) outbox.push(JSON.stringify(old) === JSON.stringify(next) ? old : next);
      sources.delete(key);
    }
    for (const [key, entry] of sources) if (!this.pending.get(key)) outbox.push(entry);
    if (outbox.length !== this.state.outbox.length || outbox.some((o, index) => o !== this.state.outbox[index])) this.state = { ...this.state, outbox };
    this.stamp = snapshot.stamp;
  }

  private defaults(): void {
    if (!this.state.lists.some(l => l.isInbox)) this.commit([{ type: "list", id: INBOX_ID, op: "create", record: { id: INBOX_ID, name: "Inbox", colour: "c1", isInbox: true } }]);
    if (!this.state.calendars.some(c => c.kind.type === "local")) this.commit([{ type: "calendar", id: PERSONAL_CALENDAR_ID, op: "create", record: { id: PERSONAL_CALENDAR_ID, name: "Personal", colour: "c2", visible: true, kind: { type: "local" } } }]);
  }

  private async load(): Promise<void> {
    const adapter = this.persistence;
    try {
      if (adapter.bootstrap && adapter.scan && adapter.scanOutbox && adapter.changes) {
        this.hydrationSeen = new Set();
        const first = await adapter.bootstrap(this.initialView);
        if (this.closed) return;
        if (!first.stamp) throw new Error("The planner revision is missing");
        this.install(first);
        for (const [type, key] of Object.entries(KEY_OF)) for (const record of this.state[key]) this.hydrationSeen.add(refKey({ type: type as RecordType, id: record.id }));
        this.defaults();
        await this.flush();
        if (this.closed) return;
        const view = this.initialView;
        this.state = { ...this.state, coverage: { phase: "partial", metadata: true, ...(view.kind === "today" ? { today: { start: view.start, end: view.end } } : {}), ...(view.kind === "calendar" ? { calendar: { start: view.start, end: view.end } } : {}), openTasks: view.kind === "tasks", taskRecords: "partial", eventRecords: "partial", outbox: "loading" } };
        if (typeof performance !== "undefined") performance.mark("planner:store-partial");
        this.emit();
        // Each conversion/publication batch is bounded; yield to rendering and input between them.
        for (const type of ["task", "event"] as const) {
          let after: string | undefined;
          for (;;) {
            await new Promise<void>(resolve => setTimeout(resolve, 0));
            if (this.closed) return;
            const batch = await adapter.scan(type, after);
            if (this.closed) return;
            const records = batch.records.filter(r => !this.hydrationSeen!.has(refKey(r)));
            this.reconcile({ records, outbox: [] });
            if (batch.done) break;
            after = batch.last;
          }
        }
        let after: number | undefined;
        for (;;) {
          await new Promise<void>(resolve => setTimeout(resolve, 0));
          if (this.closed) return;
          const batch = await adapter.scanOutbox(after);
          if (this.closed) return;
          this.reconcile({ records: [], outbox: batch.entries.map(entry => ({ type: entry.type, id: entry.id, entry })) });
          if (batch.done) break;
          after = batch.last;
        }
        await this.flush();
        if (this.closed) return;
        // A single read transaction validates a contiguous durable journal and reads all changed ids,
        // including absences. BroadcastChannel delivery is deliberately irrelevant to readiness.
        const final = await adapter.changes(first.stamp);
        if (this.closed) return;
        if (final.purgedTags) this.purgedTags = new Set(final.purgedTags);
        for (let index = 0; index < Math.max(final.records.length, final.outbox.length); index += 256) {
          this.reconcile({ records: final.records.slice(index, index + 256), outbox: final.outbox.slice(index, index + 256) });
          await new Promise<void>(resolve => setTimeout(resolve, 0));
          if (this.closed) return;
        }
        this.stamp = final.stamp;
      } else {
        const snapshot = await adapter.load();
        if (this.closed) return;
        this.install(snapshot);
        this.defaults();
      }
      this.hydrationSeen = null;
      this.state = { ...this.state, ready: true, coverage: { ...this.state.coverage, phase: "complete", metadata: true, openTasks: true, taskRecords: "complete", eventRecords: "complete", outbox: "complete" } };
      this.purgeDeleted();
      if (typeof performance !== "undefined") performance.mark("planner:store-ready");
      this.emit();
    } catch (error) {
      if (this.closed) return;
      this.writable = false;
      this.hydrationSeen = null;
      this.state = { ...this.state, ready: false, coverage: { ...this.state.coverage!, phase: "failed" }, persistence: { status: "failed", reason: describe(error, "open") } };
      this.emit();
    }
  }

  async prepareSync(): Promise<PlannerState> {
    await this.ready;
    this.assertReady();
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.flush();
      if (this.closed || this.state.persistence.status === "failed" && this.state.persistence.reason !== new StaleOperation().message) throw new Error("The planner is not ready to sync");
      const boundary = this.writes;
      const snapshot = await this.persistence.load();
      if (this.closed) throw new Error("The planner was closed");
      if (this.writes !== boundary) continue; // an edit during the read must commit before a frozen preparation
      this.install(snapshot);
      if (this.state.persistence.status === "failed") this.state = { ...this.state, persistence: this.persistence.durable ? { status: "ok" } : { status: "memory" } };
      const prepared = this.state;
      if (snapshot.stamp) this.preparedSnapshots.set(prepared, snapshot.stamp);
      this.emit();
      return prepared;
    }
    throw new StaleOperation();
  }

  // Records in memory ---------------------------------------------------------------------------

  private replaceRecord(type: RecordType, id: string, record: AnyRecord | null): void {
    const key = KEY_OF[type];
    const list = [...(this.state[key] as readonly AnyRecord[])];
    const index = list.findIndex((r) => r.id === id);
    if (record === null) {
      if (index >= 0) list.splice(index, 1);
    } else if (index >= 0) {
      list[index] = record; // a changed record keeps its place
    } else {
      list.push(record);
    }
    this.state = { ...this.state, [key]: list };
  }

  private current(type: RecordType, id: string): AnyRecord | undefined {
    return (this.state[KEY_OF[type]] as readonly AnyRecord[]).find((r) => r.id === id);
  }

  private setOutbox(type: RecordType, id: string, entry: OutboxEntry | null): void {
    const rest = this.state.outbox.filter((e) => !(e.type === type && e.id === id));
    this.state = { ...this.state, outbox: entry ? [...rest, entry] : rest };
  }

  /** Applies patches to what is on screen, as the write will apply them in storage. */
  private applyLocal(patches: Patch[], wire: Patch[], at: string): void {
    for (const [i, p] of patches.entries()) {
      if (p.op === "create") {
        if (this.current(p.type, p.id)) continue;
        this.replaceRecord(p.type, p.id, p.record);
      } else if (p.op === "purge") {
        if (p.type === "tag") this.purgedTags.add(p.id);
        this.replaceRecord(p.type, p.id, null);
      } else {
        const record = this.current(p.type, p.id);
        if (!record) continue;
        this.replaceRecord(
          p.type,
          p.id,
          applyFields(p.type, record, p.fields),
        );
      }
      if (p.local) continue;
      const existing = this.state.outbox.find((e) => e.type === p.type && e.id === p.id);
      const change = coalesce(existing, wire[i]!, at);
      if (change.write) {
        this.setOutbox(p.type, p.id, { ...change.write, seq: change.write.seq || -++this.provisional });
      } else if (change.remove !== undefined) {
        this.setOutbox(p.type, p.id, null);
      }
    }
  }

  /** Takes storage's version of records, except ones with a write still on its way. */
  private reconcile(result: ApplyResult): void {
    if (result.purgedTags) this.purgedTags = new Set(result.purgedTags);
    const grouped = new Map<RecordType, Map<string, AnyRecord | null>>();
    for (const r of result.records) {
      this.hydrationSeen?.add(refKey(r));
      if (this.pending.get(refKey(r))) continue;
      const changes = grouped.get(r.type) ?? new Map<string, AnyRecord | null>();
      changes.set(r.id, r.record ? viewOf(r.type, r.record) : null);
      grouped.set(r.type, changes);
    }
    for (const [type, changes] of grouped) {
      const key = KEY_OF[type];
      const previous = this.state[key] as readonly AnyRecord[];
      const next: AnyRecord[] = [];
      for (const record of previous) {
        if (!changes.has(record.id)) { next.push(record); continue; }
        const replacement = changes.get(record.id);
        if (replacement) next.push(JSON.stringify(record) === JSON.stringify(replacement) ? record : replacement);
        changes.delete(record.id);
      }
      for (const record of changes.values()) if (record) next.push(record);
      if (next.length !== previous.length || next.some((r, i) => r !== previous[i])) this.state = { ...this.state, [key]: next };
    }
    if (result.outbox.length) {
      const changes = new Map(result.outbox.filter(o => !this.pending.get(refKey(o))).map(o => [refKey(o), o.entry]));
      const next: OutboxEntry[] = [];
      for (const entry of this.state.outbox) {
        const key = refKey(entry);
        if (!changes.has(key)) { next.push(entry); continue; }
        const replacement = changes.get(key);
        if (replacement) next.push(JSON.stringify(entry) === JSON.stringify(replacement) ? entry : replacement);
        changes.delete(key);
      }
      for (const entry of changes.values()) if (entry) next.push(entry);
      if (next.length !== this.state.outbox.length || next.some((o, i) => o !== this.state.outbox[i])) this.state = { ...this.state, outbox: next };
    }
    this.emit();
  }

  private async refresh(refs: Ref[]): Promise<void> {
    try {
      if (this.closed) return;
      if (this.state.ready && this.stamp && this.persistence.changes) {
        const result = await this.persistence.changes(this.stamp);
        if (this.closed) return;
        this.reconcile(result);
        this.stamp = result.stamp;
      } else {
        const result = await this.persistence.read(refs);
        if (!this.closed) this.reconcile(result);
      }
    } catch {
      // The next write or reload will say if storage is broken.
    }
  }

  /** Makes a change: on screen now, in storage and the outbox next, and tells other tabs. */
  private commit(inputs: PatchInput[], complete = false, propagate = false, captured?: DatabaseStamp): Promise<void> {
    const expected = captured ?? (complete || !this.state.ready ? this.stamp : undefined);
    const covered = !this.state.ready ? inputs.filter(p => p.type === "task").map(p => ({ id: p.id })) : undefined;
    let failure: unknown;
    const at = this.now().toISOString();
    const patches = inputs.map((p) => ({ ...p, key: this.newId() }) as Patch);
    // What is stored and sent is the engine's shape; the app holds events with their skips gathered.
    const wire = patches.map((p) => (p.op === "create" ? { ...p, record: storedOf(p.type, p.record) } : p));
    this.applyLocal(patches, wire, at);
    this.emit();
    if (!this.writable) return propagate ? Promise.reject(new Error("The planner is not writable")) : Promise.resolve();
    for (const p of patches) this.pending.set(refKey(p), (this.pending.get(refKey(p)) ?? 0) + 1);
    this.writes = this.writes.then(async () => {
      if (this.closed) {
        failure = new Error("The planner was closed");
        for (const p of patches) this.pending.set(refKey(p), (this.pending.get(refKey(p)) ?? 1) - 1);
        return;
      }
      try {
        let fence = expected;
        if (fence && !propagate) { while (this.ownRevisions.has(fence.revision + 1)) fence = { ...fence, revision: fence.revision + 1 }; }
        const result = await this.persistence.apply({ at, patches: wire }, fence, covered);
        if (result.stamp && result.before && result.stamp.revision === result.before.revision + 1) {
          this.ownRevisions.add(result.stamp.revision);
          if (this.ownRevisions.size > 4096) this.ownRevisions.delete(this.ownRevisions.values().next().value!);
        }
        for (const p of patches) this.pending.set(refKey(p), (this.pending.get(refKey(p)) ?? 1) - 1);
        if (this.closed) return;
        if (this.state.persistence.status === "failed" && this.state.persistence.reason === new StaleOperation().message) this.state = { ...this.state, persistence: this.persistence.durable ? { status: "ok" } : { status: "memory" } };
        this.reconcile(result);
        // This result proves only our own refs. A skipped revision must still be replayed before
        // complete-set operations; advancing over it would hide a lost broadcast from another tab.
        if (result.stamp && (!this.stamp || result.stamp.generation === this.stamp.generation && result.stamp.revision === this.stamp.revision + 1)) this.stamp = result.stamp;
        this.channel?.postMessage({ tab: this.tab, refs: patches.map((p) => ({ type: p.type, id: p.id })) });
      } catch (error) {
        failure = error;
        for (const p of patches) this.pending.set(refKey(p), (this.pending.get(refKey(p)) ?? 1) - 1);
        if (this.closed) return;
        // Storage failures retain unsaved edits. A stale candidate is recoverable from a fresh snapshot.
        if (error instanceof StaleOperation) {
          // Roll back this operation's optimistic effects from authoritative storage. Other pending
          // edits remain protected by install(). No stale batch ever reached records or outbox.
          try { this.install(await this.persistence.load()); } catch { /* Keep the visible failure if recovery cannot read. */ }
          this.setPersistence({ status: "failed", reason: error.message });
        } else this.setPersistence({ status: "failed", reason: describe(error, "write") });
      }
    });
    return this.writes.then(() => { if (propagate && failure) throw failure; });
  }

  // Tasks ---------------------------------------------------------------------------------------

  private task(id: string): Task {
    const found = this.state.tasks.find((t) => t.id === id);
    if (!found) throw new Error(`No task ${id}`);
    return found;
  }

  private change(id: string, op: "update" | "delete", fields: Record<string, unknown>): void {
    if (this.closed) this.assertReady();
    const task = this.task(id);
    if (!this.state.ready && (!this.state.coverage?.metadata || task.repeat || task.overrideOf || "repeat" in fields || "overrideOf" in fields || "deletedAt" in fields || this.state.coverage.phase === "failed")) this.assertReady();
    // Tags purged for good: the fields that still name them go with this edit, and only this task's (no rewrite of the rest).
    for (const tagId of task.tags) {
      if (this.purgedTags.has(tagId) && !this.state.tags.some((t) => t.id === tagId) && !(`${TAG_PREFIX}${tagId}` in fields)) fields = { ...fields, [`${TAG_PREFIX}${tagId}`]: false };
    }
    this.commit([{ type: "task", id, op, fields: { ...fields, updatedAt: this.now().toISOString() } }], Boolean(task.repeat || task.overrideOf || "repeat" in fields || "deletedAt" in fields));
  }

  addTask(input: NewTask): Task {
    this.assertReady();
    const inbox = this.state.lists.find((l) => l.isInbox);
    const stamp = this.now().toISOString();
    const task: Task = {
      id: this.newId(),
      title: input.title.trim(),
      notes: input.notes ?? "",
      listId: input.listId ?? inbox!.id,
      due: input.due ?? null,
      priority: input.priority ?? "none",
      done: false,
      completedAt: null,
      deletedAt: null,
      checklist: input.checklist ?? [],
      tags: [...new Set(input.tags ?? [])].sort(),
      projectId: input.projectId ?? null,
      sectionId: input.sectionId ?? null,
      repeat: input.repeat ? newSeries((input.due ?? stamp).slice(0, 10), input.repeat) : null,
      reminder: input.reminder ?? null,
      overrideOf: input.overrideOf ?? null,
      completions: [],
      createdAt: stamp,
      updatedAt: stamp,
    };
    this.commit([{ type: "task", id: task.id, op: "create", record: task }]);
    return task;
  }

  updateTask(id: string, patch: TaskPatch): void {
    const { repeat, ...rest } = patch;
    const fields: Record<string, unknown> = { ...rest };
    if (repeat !== undefined) {
      if (repeat) validate(repeat);
      Object.assign(fields, repeatFields(this.task(id).repeat, repeat));
    }
    this.change(id, "update", fields);
  }

  setDone(id: string, done: boolean): void {
    const task = this.task(id);
    // Completing a repeating task moves it to its next date instead of finishing it.
    if (done && task.repeat) this.change(id, "update", completeRepeating(task, this.now().toISOString()));
    else this.change(id, "update", { done, completedAt: done ? this.now().toISOString() : null });
  }

  deleteTask(id: string): void {
    const stamp = this.now().toISOString();
    // One-off copies of single dates outlive their series: they keep their title and stand alone.
    const copies = this.state.tasks.filter((t) => t.overrideOf?.id === id && t.deletedAt === null);
    this.assertReady();
    this.task(id);
    this.commit([
      { type: "task", id, op: "delete", fields: { deletedAt: stamp, updatedAt: stamp } },
      ...copies.map((c): PatchInput => ({ type: "task", id: c.id, op: "update", fields: { overrideOf: null, updatedAt: stamp } })),
    ], true);
  }

  restoreTask(id: string): void {
    const task = this.task(id);
    // A section deleted in the meantime no longer exists: the task comes back to the project's top.
    const project = task.projectId ? this.state.projects.find((p) => p.id === task.projectId) : undefined;
    const lost = task.sectionId !== null && !project?.sections.some((s) => s.id === task.sectionId);
    this.change(id, "update", { deletedAt: null, ...(lost ? { sectionId: null } : {}) });
  }

  /**
   * Removes records deleted more than 30 days ago for good (a record never sent leaves no trace;
   * one that was sent leaves a delete entry in the outbox).
   *
   * It does nothing when this device's clock is more than a day past the newest timestamp it can
   * trust. A timestamp can be trusted only if this device did not just make it with the clock being
   * checked, so anything stamped within the last minute is ignored: otherwise a clock jumped far
   * ahead would stamp a fresh record, look up to date and wipe the whole Deleted list. Until sync
   * exists the evidence is the device's own older stamps; once it does, the newest server time
   * replaces them. After a long idle spell the purge waits for the next session after a change.
   */
  purgeDeleted(): number {
    this.assertReady();
    const stamps = [
      ...this.state.tasks.flatMap((t) => [t.createdAt, t.updatedAt, t.completedAt, t.deletedAt]),
      ...this.state.events.flatMap((e) => [e.createdAt, e.updatedAt, e.deletedAt]),
      ...this.state.tags.map((t) => t.deletedAt),
      ...this.state.outbox.flatMap((e) => [e.createdAt, e.updatedAt]),
    ]
      .filter((s): s is string => s !== null)
      .map((s) => new Date(s).getTime())
      .filter((t) => t <= this.now().getTime() - CLOCK_CHECK_MS);
    const newest = stamps.length ? Math.max(...stamps) : 0;
    if (this.now().getTime() - newest > DAY_MS) return 0;
    const cutoff = this.now().getTime() - RESTORE_DAYS * DAY_MS;
    const gone = (x: { deletedAt: string | null }) => x.deletedAt !== null && new Date(x.deletedAt).getTime() < cutoff;
    const patches: PatchInput[] = [
      ...this.state.tasks.filter(gone).map((t): PatchInput => ({ type: "task", id: t.id, op: "purge" })),
      ...this.state.events.filter(gone).map((e): PatchInput => ({ type: "event", id: e.id, op: "purge" })),
      ...this.state.tags.filter(gone).map((t): PatchInput => ({ type: "tag", id: t.id, op: "purge" })),
    ];
    if (patches.length === 0) return 0;
    this.commit(patches, true);
    return patches.length;
  }

  // Tags ----------------------------------------------------------------------------------------

  private tag(id: string): Tag {
    const found = this.state.tags.find((t) => t.id === id);
    if (!found) throw new Error(`No tag ${id}`);
    return found;
  }

  /** Whether another live tag already has this name, ignoring case. */
  private nameTaken(name: string, except?: string): boolean {
    const wanted = name.trim().toLowerCase();
    return this.state.tags.some((t) => t.deletedAt === null && t.id !== except && t.name.trim().toLowerCase() === wanted);
  }

  addTag(name: string, colour: ListColour): Tag {
    this.assertReady();
    if (this.nameTaken(name)) throw new DuplicateTagName();
    const tag: Tag = { id: this.newId(), name: name.trim(), colour, deletedAt: null };
    this.commit([{ type: "tag", id: tag.id, op: "create", record: tag }], true);
    return tag;
  }

  updateTag(id: string, patch: TagPatch): void {
    this.assertReady();
    const current = this.tag(id);
    const fields: Record<string, unknown> = { ...patch };
    if (patch.name !== undefined) {
      fields.name = patch.name.trim() || current.name;
      if (this.nameTaken(fields.name as string, id)) throw new DuplicateTagName();
    }
    this.commit([{ type: "tag", id, op: "update", fields }], patch.name !== undefined);
  }

  deleteTag(id: string): void {
    this.assertReady();
    this.tag(id);
    this.commit([{ type: "tag", id, op: "delete", fields: { deletedAt: this.now().toISOString() } }]);
  }

  restoreTag(id: string): void {
    this.assertReady();
    this.tag(id);
    this.commit([{ type: "tag", id, op: "update", fields: { deletedAt: null } }]);
  }

  setTaskTag(taskId: string, tagId: string, on: boolean): void {
    this.assertReady();
    this.task(taskId);
    // One field per tag, never a list: the tags of a task merge as a set.
    this.change(taskId, "update", { [`${TAG_PREFIX}${tagId}`]: on });
  }

  // Lists ---------------------------------------------------------------------------------------

  addList(name: string, colour: ListColour): TaskList {
    this.assertReady();
    const list: TaskList = { id: this.newId(), name: name.trim(), colour, isInbox: false };
    this.commit([{ type: "list", id: list.id, op: "create", record: list }]);
    return list;
  }

  updateList(id: string, patch: ListPatch): void {
    this.assertReady();
    const current = this.state.lists.find((l) => l.id === id);
    if (!current) throw new Error(`No list ${id}`);
    const fields: Record<string, unknown> = { ...patch };
    if (patch.name !== undefined) fields.name = patch.name.trim() || current.name;
    this.commit([{ type: "list", id, op: "update", fields }]);
  }

  // Projects ------------------------------------------------------------------------------------

  private project(id: string): Project {
    const found = this.state.projects.find((p) => p.id === id);
    if (!found) throw new Error(`No project ${id}`);
    return found;
  }

  addProject(input: NewProject): Project {
    this.assertReady();
    const project: Project = { id: this.newId(), name: input.name.trim(), colour: input.colour, goal: input.goal ?? null, sections: [], archived: false };
    this.commit([{ type: "project", id: project.id, op: "create", record: project }]);
    return project;
  }

  updateProject(id: string, patch: ProjectPatch): void {
    this.assertReady();
    const current = this.project(id);
    const fields: Record<string, unknown> = { ...patch };
    if (patch.name !== undefined) fields.name = patch.name.trim() || current.name;
    this.commit([{ type: "project", id, op: "update", fields }]);
  }

  addSection(projectId: string, name: string): ProjectSection {
    this.assertReady();
    const project = this.project(projectId);
    const last = inOrder(project.sections).at(-1)?.order ?? null;
    const order = keyBetween(last, null);
    if (order === null) throw new Error("Too many sections");
    const section: ProjectSection = { id: this.newId(), name: name.trim(), order };
    this.commit([{ type: "project", id: projectId, op: "update", fields: sectionFields.add(section) }]);
    return section;
  }

  renameSection(projectId: string, sectionId: string, name: string): void {
    this.assertReady();
    const section = this.project(projectId).sections.find((s) => s.id === sectionId);
    if (!section) return;
    this.commit([{ type: "project", id: projectId, op: "update", fields: sectionFields.rename(sectionId, name.trim() || section.name) }]);
  }

  moveSection(projectId: string, sectionId: string, direction: "up" | "down"): void {
    this.assertReady();
    const project = this.project(projectId);
    const sorted = inOrder(project.sections);
    const i = sorted.findIndex((s) => s.id === sectionId);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= sorted.length) return;
    // Take the section out and put its key between its new neighbours; no other section changes.
    const rest = sorted.filter((s) => s.id !== sectionId);
    const order = keyBetween(rest[j - 1]?.order ?? null, rest[j]?.order ?? null);
    if (order === null) return;
    this.commit([{ type: "project", id: projectId, op: "update", fields: sectionFields.move(sectionId, order) }]);
  }

  deleteSection(projectId: string, sectionId: string): void {
    this.assertReady();
    this.project(projectId);
    const moved = this.state.tasks.filter((t) => t.sectionId === sectionId && t.deletedAt === null);
    const stamp = this.now().toISOString();
    this.commit([
      { type: "project", id: projectId, op: "update", fields: sectionFields.remove(sectionId) },
      ...moved.map((t): PatchInput => ({ type: "task", id: t.id, op: "update", fields: { sectionId: null, updatedAt: stamp } })),
    ], true);
  }

  // Events and calendars ------------------------------------------------------------------------

  private event(id: string): CalendarEvent {
    const found = this.state.events.find((e) => e.id === id);
    if (!found) throw new Error(`No event ${id}`);
    if (found.readOnly) throw new Error("This event belongs to a subscribed calendar");
    return found;
  }

  private changeEvent(id: string, op: "update" | "delete", fields: Record<string, unknown>): void {
    this.assertReady();
    this.event(id);
    this.commit([{ type: "event", id, op, fields: { ...fields, updatedAt: this.now().toISOString() } }], "repeat" in fields);
  }

  addEvent(input: NewEvent): CalendarEvent {
    this.assertReady();
    const calendar = this.state.calendars.find((c) => c.id === input.calendarId) ?? this.state.calendars.find((c) => c.kind.type === "local");
    const stamp = this.now().toISOString();
    const event: CalendarEvent = {
      id: this.newId(),
      title: input.title.trim(),
      calendarId: calendar!.id,
      allDay: input.allDay ?? false,
      start: input.start,
      end: input.end,
      place: input.place ?? "",
      notes: input.notes ?? "",
      people: input.people ?? [],
      reminder: input.reminder ?? null,
      repeat: input.series ?? (input.repeat ? newSeries(input.start.slice(0, 10), input.repeat) : null),
      overrideOf: input.overrideOf ?? null,
      zone: input.zone ?? null,
      readOnly: false,
      deletedAt: null,
      createdAt: stamp,
      updatedAt: stamp,
    };
    if (event.repeat) validate(event.repeat);
    this.commit([{ type: "event", id: event.id, op: "create", record: event }]);
    return event;
  }

  updateEvent(id: string, patch: EventPatch): void {
    const current = this.event(id);
    const { repeat, ...rest } = patch;
    const fields: Record<string, unknown> = { ...rest };
    let next = repeat;
    // Moving a repeating event moves its series; the rule and the skipped dates stay.
    if (patch.start !== undefined && current.repeat && next === undefined) next = { ...current.repeat, start: patch.start.slice(0, 10) };
    if (next !== undefined) {
      if (next) validate(next);
      Object.assign(fields, repeatFields(current.repeat, next));
    }
    this.changeEvent(id, "update", fields);
  }

  deleteEvent(id: string): void {
    this.changeEvent(id, "delete", { deletedAt: this.now().toISOString() });
  }

  restoreEvent(id: string): void {
    this.changeEvent(id, "update", { deletedAt: null });
  }

  addCalendar(name: string, colour: ListColour): PlannerCalendar {
    this.assertReady();
    const calendar: PlannerCalendar = { id: this.newId(), name: name.trim(), colour, visible: true, kind: { type: "local" } };
    this.commit([{ type: "calendar", id: calendar.id, op: "create", record: calendar }]);
    return calendar;
  }

  addSubscription(name: string, colour: ListColour, url: string): PlannerCalendar {
    this.assertReady();
    const calendar: PlannerCalendar = {
      id: this.newId(),
      name: name.trim(),
      colour,
      visible: true,
      kind: { type: "subscribed", url, lastRefreshed: null, error: null },
    };
    this.commit([{ type: "calendar", id: calendar.id, op: "create", record: calendar }]);
    return calendar;
  }

  private calendar(id: string): PlannerCalendar {
    const found = this.state.calendars.find((c) => c.id === id);
    if (!found) throw new Error(`No calendar ${id}`);
    return found;
  }

  updateCalendar(id: string, patch: CalendarPatch): void {
    this.assertReady();
    const current = this.calendar(id);
    const fields: Record<string, unknown> = { ...patch };
    if (patch.name !== undefined) fields.name = patch.name.trim() || current.name;
    this.commit([{ type: "calendar", id, op: "update", fields }]);
  }

  replaceFeedEvents(calendarId: string, events: FeedEvent[]): void {
    this.assertReady();
    const calendar = this.calendar(calendarId);
    if (calendar.kind.type !== "subscribed") throw new Error("Not a subscribed calendar");
    const at = this.now().toISOString();
    const fresh = events.map((e): CalendarEvent => ({
      id: this.newId(),
      title: e.title,
      calendarId,
      allDay: e.allDay ?? false,
      start: e.start,
      end: e.end,
      place: e.place ?? "",
      notes: e.notes ?? "",
      people: [],
      reminder: null,
      repeat: e.series ?? null,
      overrideOf: null,
      zone: e.zone ?? null,
      readOnly: true,
      deletedAt: null,
      createdAt: at,
      updatedAt: at,
    }));
    // Reading a feed is not a person's edit: these patches are `local`, so nothing goes to the outbox.
    this.commit([
      ...this.state.events.filter((e) => e.calendarId === calendarId).map((e): PatchInput => ({ type: "event", id: e.id, op: "purge", local: true })),
      ...fresh.map((e): PatchInput => ({ type: "event", id: e.id, op: "create", record: e, local: true })),
      { type: "calendar", id: calendarId, op: "update", fields: { kind: { ...calendar.kind, lastRefreshed: at, error: null } }, local: true },
    ], true);
  }

  failSubscription(calendarId: string, error: string): void {
    this.assertReady();
    const calendar = this.calendar(calendarId);
    if (calendar.kind.type !== "subscribed") throw new Error("Not a subscribed calendar");
    this.commit([{ type: "calendar", id: calendarId, op: "update", fields: { kind: { ...calendar.kind, error } }, local: true }], true);
  }
}
