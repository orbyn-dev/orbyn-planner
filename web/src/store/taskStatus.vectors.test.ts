// @vitest-environment node
//
// The shared test vectors for task status (orbyn-engine: crates/orbyn-planner/tests/vectors/task-status.json), read from the engine
// checkout at the pinned commit, the same path `generate:check` uses (ORBYN_ENGINE_DIR). The engine's own tests run the same file.
import { describe, expect, it } from "vitest";
import { exportJson } from "../features/export/exportJson";
import { stampFields, valuesOf, type StampedFields } from "../sync/mapping";
import { LocalStore } from "./LocalStore";
import { MemoryPersistence } from "./persistence";
import { repeatEvery } from "./repeat";
import { icsStatus, laneOf, moveTo, statusOf, type Lane } from "./taskStatus";
import { undoableTasks } from "./taskRepeat";
import type { Task } from "./types";

const nodeFs = "node:fs";
const nodePath = "node:path";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { existsSync(p: string): boolean; readFileSync(p: string, e: "utf8"): string };
const path = (await import(/* @vite-ignore */ nodePath)) as { join(...p: string[]): string };
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process!.env;

const file = env.ORBYN_ENGINE_DIR ? path.join(env.ORBYN_ENGINE_DIR, "crates/orbyn-planner/tests/vectors/task-status.json") : null;
// Locally the engine checkout is optional; in CI it must be there, or the vectors would silently not run.
if (env.CI && (!file || !fs.existsSync(file))) throw new Error("ORBYN_ENGINE_DIR must point at the pinned engine checkout: the task-status vectors are not optional in CI.");
const present = file !== null && fs.existsSync(file);

interface Vectors {
  version: number;
  reading: { name: string; fields: { status?: string | null; done_at?: string | null }; status: string; lane: Lane }[];
  moves: { name: string; from: { status: string; done: boolean }; to: Lane; expect: { status: string; done: boolean } }[];
  undo: { name: string; before: { status: string; done: boolean }; moved_to: Lane; after_undo: { status: string; done: boolean } }[];
  merge: { name: string; base: Record<string, unknown>; writes: Write[]; expect: Outcome; then?: Write[]; expect_after?: Outcome }[];
  repeat: { name: string; before: { status: string }; expect: { status: string; done: boolean } }[];
  ics: { name: string; status: string; done: boolean; STATUS: string; "X-ORBYN-STATUS": string | null }[];
  json_export: { name: string; status: string; done: boolean; exports: { status: string } }[];
}
interface Write { device: number; millis: number; set: Record<string, unknown> }
interface Outcome { status: string; done: boolean; lane: Lane }

const NOW = "2026-11-08T09:00:00.000Z";
const vectors: Vectors | null = present ? (JSON.parse(fs.readFileSync(file!, "utf8")) as Vectors) : null;

const taskOf = (fields: { status?: string | null; done_at?: string | null }): Pick<Task, "status" | "done"> => ({ status: fields.status, done: fields.done_at !== undefined && fields.done_at !== null });
const kept = (task: Pick<Task, "status">) => (typeof task.status === "string" ? task.status : "todo");

async function newStore() {
  const store = new LocalStore({ persistence: new MemoryPersistence(), now: () => new Date(NOW), broadcast: false });
  await store.ready;
  return store;
}

/** A field-by-field merge with the engine's stamp order: millis, then counter, then device id; the later stamp wins each field. */
function merge(fields: StampedFields, writes: Write[], counter: number): StampedFields {
  const out: StampedFields = { ...fields };
  for (const w of writes) {
    const incoming = stampFields(w.set, { millis: w.millis, counter, device: w.device });
    for (const [name, f] of Object.entries(incoming)) {
      const have = out[name];
      const later = !have || [f.stamp.millis - have.stamp.millis, f.stamp.counter - have.stamp.counter, f.stamp.device - have.stamp.device].find((d) => d !== 0)! > 0;
      if (later) out[name] = f;
    }
  }
  return out;
}

describe.skipIf(!present)("task status: the shared vectors", () => {
  it("is the version this code reads", () => expect(vectors!.version).toBe(1));

  it.each(vectors?.reading ?? [])("reading: $name", (v) => {
    const task = taskOf(v.fields);
    expect(kept(task)).toBe(v.status);
    expect(laneOf(task)).toBe(v.lane);
    expect(statusOf(task)).toBe(v.lane === "done" ? statusOf(task) : v.lane);
  });

  it.each(vectors?.moves ?? [])("moves: $name", (v) => {
    const task = { status: v.from.status, done: v.from.done, completedAt: v.from.done ? "2026-11-08T08:00:00.000Z" : null };
    const patch = moveTo(task, v.to, NOW);
    const after = { status: patch.status === undefined ? task.status : patch.status, done: patch.done === undefined ? task.done : patch.done };
    expect({ status: kept(after), done: after.done }).toEqual(v.expect);
    if (v.to === laneOf(task)) expect(patch).toEqual({}); // nothing is written, so an unknown status is not rewritten
  });

  it.each(vectors?.undo ?? [])("undo: $name", async (v) => {
    const store = await newStore();
    const task = store.addTask({ title: "x" });
    store.updateTask(task.id, { status: v.before.status, done: v.before.done, completedAt: v.before.done ? NOW : null });
    const was = store.getState().tasks[0]!;
    const { undo } = undoableTasks(store, () => store.updateTask(task.id, moveTo(was, v.moved_to, NOW)));
    undo();
    const back = store.getState().tasks[0]!;
    expect({ status: kept(back), done: back.done }).toEqual(v.after_undo);
    expect(back.completedAt).toBe(was.completedAt);
  });

  it.each(vectors?.repeat ?? [])("repeat: $name", async (v) => {
    const store = await newStore();
    const task = store.addTask({ title: "bins", due: "2026-11-09", repeat: repeatEvery("weekly") });
    store.updateTask(task.id, { status: v.before.status });
    store.setDone(task.id, true);
    const after = store.getState().tasks[0]!;
    expect({ status: kept(after), done: after.done }).toEqual(v.expect);
  });

  it.each(vectors?.ics ?? [])("ics: $name", (v) => {
    const out = icsStatus({ status: v.status, done: v.done });
    expect(out.STATUS).toBe(v.STATUS);
    expect(out.X_ORBYN_STATUS).toBe(v["X-ORBYN-STATUS"]);
  });

  it.each(vectors?.json_export ?? [])("json export: $name", async (v) => {
    const store = await newStore();
    const task = store.addTask({ title: "x" });
    store.updateTask(task.id, { status: v.status });
    const out = JSON.parse(exportJson(store.getState(), NOW)) as { tasks: { status: string }[] };
    expect(out.tasks[0]!.status).toBe(v.exports.status);
  });

  // The merge itself is the engine's (this build ships it as the wasm module); here the stamped fields take the same path through the
  // planner's record mapping, so what the field order decides is what the planner reads back.
  it.each(vectors?.merge ?? [])("merge: $name", (v) => {
    let fields = stampFields(v.base, { millis: 1, counter: 0, device: 0 });
    fields = merge(fields, v.writes, 1);
    const read = (f: StampedFields) => {
      const values = valuesOf(f);
      const task = { status: values.status as string | null | undefined, done: values.done_at !== undefined && values.done_at !== null };
      return { status: kept(task), done: task.done, lane: laneOf(task) };
    };
    expect(read(fields)).toEqual(v.expect);
    if (v.then) {
      fields = merge(fields, v.then, 2);
      expect(read(fields)).toEqual(v.expect_after);
    }
  });
});
