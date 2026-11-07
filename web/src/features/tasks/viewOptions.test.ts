import { beforeEach, describe, expect, it } from "vitest";
import type { Task, TaskList } from "../../store/types";
import { DEFAULT_VIEW_OPTIONS, groupFor, lanesFor, loadViewOptions, saveViewOptions, sortTasks } from "./viewOptions";

const NOW = new Date(2026, 10, 7, 10, 0);
let n = 0;
const task = (p: Partial<Task>): Task => ({ id: `t${++n}`, title: "x", notes: "", listId: "a", due: null, priority: "none", done: false, completedAt: null, deletedAt: null, checklist: [], tags: [], projectId: null, sectionId: null, repeat: null, reminder: null, completions: [], overrideOf: null, createdAt: `2026-11-0${n % 9 + 1}T08:00`, ...p }) as Task;
const lists = [{ id: "a", name: "Work" }, { id: "b", name: "Home" }] as TaskList[];
const titles = (ts: Task[]) => ts.map((t) => t.title);

beforeEach(() => window.localStorage.clear());

describe("view options", () => {
  const ts = [task({ title: "b", priority: "low", due: "2026-11-09" }), task({ title: "a", priority: "high" }), task({ title: "c", priority: "medium", due: "2026-11-08", listId: "b" })];

  it("sorts by due (undated last), priority, name and reverses", () => {
    expect(titles(sortTasks(ts, "due"))).toEqual(["c", "b", "a"]);
    expect(titles(sortTasks(ts, "priority"))).toEqual(["a", "c", "b"]);
    expect(titles(sortTasks(ts, "name"))).toEqual(["a", "b", "c"]);
    expect(titles(sortTasks(ts, "name", true))).toEqual(["c", "b", "a"]);
  });

  it("groups by none, priority and list; by due keeps the date buckets", () => {
    expect(groupFor(ts, lists, NOW, { ...DEFAULT_VIEW_OPTIONS, groupBy: "none" })).toHaveLength(1);
    expect(groupFor([], lists, NOW, { ...DEFAULT_VIEW_OPTIONS, groupBy: "none" })).toEqual([]);
    expect(groupFor(ts, lists, NOW, { ...DEFAULT_VIEW_OPTIONS, groupBy: "priority" }).map((g) => g.label)).toEqual(["High", "Medium", "Low"]);
    expect(groupFor(ts, lists, NOW, { ...DEFAULT_VIEW_OPTIONS, groupBy: "list" }).map((g) => g.label)).toEqual(["Work", "Home"]);
    expect(groupFor(ts, lists, NOW, DEFAULT_VIEW_OPTIONS).map((g) => g.label)).toContain("No date");
  });

  it("board lanes: Done lane is optional and cards follow the lane sort", () => {
    const all = [...ts, task({ title: "d", done: true })];
    expect(lanesFor(all, DEFAULT_VIEW_OPTIONS).map((l) => l.label)).toEqual(["To do", "Done"]);
    const lanes = lanesFor(all, { ...DEFAULT_VIEW_OPTIONS, showDone: false, boardSort: "priority" });
    expect(lanes).toHaveLength(1);
    expect(titles(lanes[0]!.tasks)).toEqual(["a", "c", "b"]);
  });

  it("remembers choices on this device and ignores junk", () => {
    saveViewOptions({ ...DEFAULT_VIEW_OPTIONS, groupBy: "list", descending: true });
    expect(loadViewOptions()).toMatchObject({ groupBy: "list", descending: true });
    window.localStorage.setItem("orbyn-planner.tasks-view", '{"groupBy":"nope"}');
    expect(loadViewOptions()).toEqual(DEFAULT_VIEW_OPTIONS);
  });
});
