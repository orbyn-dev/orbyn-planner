import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { ClockProvider } from "../../app/clock";
import { LocalStore } from "../../store/LocalStore";
import type { Task } from "../../store/types";
import { MemoryPersistence } from "../../store/persistence";

// The panel stops offering tags at MAX_TAGS_PER_TASK. The real limit (100, covered in the store tests) would mean 100 chips on the page in the
// row and the panel, so this file runs with a limit of 3; nothing else here has three tags on a task.
vi.mock("../../store/records", async (original) => ({ ...(await original<typeof import("../../store/records")>()), MAX_TAGS_PER_TASK: 3 }));

const NOW = new Date(2026, 10, 7, 10, 0);

async function open(path = "/tasks", seed?: (store: LocalStore, water: Task) => void) {
  window.history.replaceState(null, "", path);
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
  const store = new LocalStore({ persistence: new MemoryPersistence(), now: () => NOW, broadcast: false });
  await store.ready;
  const water = store.addTask({ title: "water plants", due: "2026-11-09T09:00" });
  const mail = store.addTask({ title: "post the parcel", due: "2026-11-10" });
  seed?.(store, water); // before the first render, so the page isn't redrawn for every record
  const root = document.createElement("div");
  root.id = "root";
  document.body.appendChild(root);
  render(
    <ClockProvider value={() => NOW}>
      <App store={store} />
    </ClockProvider>,
    { container: root },
  );
  return { store, water, mail };
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => document.getElementById("root")?.remove());

const row = (title: string) => screen.getByRole("button", { name: title }).closest("li")!;

describe("tags in the planner", () => {
  const openTags = async (panel: HTMLElement) => {
    await userEvent.click(within(panel).getByRole("button", { name: /^Tags,/ }));
    return screen.getByRole("dialog", { name: "Tags" });
  };

  it("the Tags row is always there, after List: \"Add tag\" when empty, then chips and a +", async () => {
    const { store, water } = await open();
    await userEvent.click(await screen.findByRole("button", { name: "water plants" }));
    const panel = screen.getByRole("complementary", { name: "Task" });
    const labels = () => Array.from(panel.querySelectorAll(".kv > span:first-child")).map((e) => e.textContent);
    expect(labels().slice(0, 4)).toEqual(["Due", "List", "Tags", "Priority"]);
    const button = within(panel).getByRole("button", { name: "Tags, none" });
    expect(button).toHaveTextContent("Add tag");
    expect(button.querySelector(".t3")).not.toBeNull(); // muted
    await act(async () => {
      store.setTaskTag(water.id, store.addTag("bug", "c1").id, true);
      store.setTaskTag(water.id, store.addTag("email", "c2").id, true);
    });
    expect(within(panel).getByRole("button", { name: "Tags, bug, email" })).toHaveTextContent("bugemail+");
  });

  it("in a list row the chips follow the title inside their own box, which gives way first in a narrow row, so they never sit over the title", async () => {
    const { store, water } = await open();
    await act(async () => {
      store.setTaskTag(water.id, store.addTag("bug", "c1").id, true);
      store.setTaskTag(water.id, store.addTag("email", "c2").id, true);
    });
    const wrap = row("water plants").querySelector(".ttwrap")!;
    expect(Array.from(wrap.children).map((c) => c.className.split(" ")[0])).toEqual(["tt", "tagchips"]);
    expect(wrap.querySelector(".tagchips")!.querySelectorAll(".tagchip")).toHaveLength(2);
    // The rule that does it (jsdom has no layout): the chips box shrinks far faster than the title and clips instead of overflowing.
    const nodeFs = "node:fs";
    const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync(path: string, encoding: "utf8"): string };
    const css = fs.readFileSync(`${(globalThis as { process?: { cwd(): string } }).process!.cwd()}/src/styles/app.css`, "utf8");
    const i = css.indexOf(".ttwrap .tagchips {");
    expect(i).toBeGreaterThan(-1);
    expect(css.slice(i, css.indexOf("}", i))).toMatch(/flex: 0 20 auto; min-width: 0; overflow: hidden/);
    expect(css.slice(css.indexOf(".ttwrap {"), css.indexOf("}", css.indexOf(".ttwrap {")))).toMatch(/overflow: hidden/);
  });

  it("the popover has a search field, the existing tags with checkboxes and Create tag “…” when none has exactly that name; changes apply at once", async () => {
    const { store, water } = await open("/tasks", (s) => {
      s.addTag("errands", "c4");
      s.addTag("bug", "c1");
    });
    await userEvent.click(await screen.findByRole("button", { name: "water plants" }));
    const panel = screen.getByRole("complementary", { name: "Task" });
    const dialog = await openTags(panel);
    expect(within(dialog).getByRole("textbox", { name: "Search tags" })).toHaveFocus();
    expect(within(dialog).getAllByRole("checkbox").map((c) => c.closest("label")!.textContent)).toEqual(["errands", "bug"]);
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "bug" }));
    expect(store.getState().tasks.find((t) => t.id === water.id)!.tags).toHaveLength(1);
    expect(within(row("water plants")).getByText("bug")).toBeInTheDocument();
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Search tags" }), "er");
    expect(within(dialog).getAllByRole("checkbox").map((c) => c.closest("label")!.textContent)).toEqual(["errands"]);
    expect(within(dialog).getByRole("button", { name: /Create tag “er”/ })).toBeInTheDocument();
    await userEvent.clear(within(dialog).getByRole("textbox", { name: "Search tags" }));
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Search tags" }), "BUG");
    expect(within(dialog).queryByRole("button", { name: /Create tag/ })).toBeNull(); // exactly that name, in any case
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "bug" }));
    expect(store.getState().tasks.find((t) => t.id === water.id)!.tags).toHaveLength(0);
  });

  it("Enter in the search field creates the tag and gives it to the task; Escape closes with focus back on the row", async () => {
    const { store, water } = await open();
    await userEvent.click(await screen.findByRole("button", { name: "water plants" }));
    const panel = screen.getByRole("complementary", { name: "Task" });
    const dialog = await openTags(panel);
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Search tags" }), "Home{Enter}");
    expect(store.getState().tags.map((t) => t.name)).toEqual(["Home"]);
    expect(store.getState().tasks.find((t) => t.id === water.id)!.tags).toEqual([store.getState().tags[0]!.id]);
    expect(within(row("water plants")).getByText("Home")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Tags" })).toBeNull();
    expect(within(panel).getByRole("button", { name: "Tags, Home" })).toHaveFocus();
  });

  it("the Tasks page filters by tag", async () => {
    await open("/tasks", (store, task) => {
      store.setTaskTag(task.id, store.addTag("Home", "c2").id, true);
    });
    await userEvent.click(await screen.findByRole("button", { name: "Tag: Any tag" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: /Home/ }));
    expect(screen.getByRole("button", { name: "water plants" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "post the parcel" })).toBeNull();
  });

  it("Settings · Tags makes, renames and deletes tags; a deleted tag disappears from the tasks, and Restore brings it back (Planner Designs v64 p-set-tags)", async () => {
    const { store, mail } = await open("/settings");
    const tag = store.addTag("Errands", "c4");
    store.setTaskTag(mail.id, tag.id, true);
    await userEvent.click(await screen.findByRole("button", { name: "Tags" }));
    expect(screen.getByText("1 task")).toBeInTheDocument();
    expect(screen.getByText("Deleting a tag hides it. You can restore it for 30 days.")).toBeInTheDocument();
    // Add: off until a name is typed; a name that exists (any case) shows the error and keeps Add off.
    const add = screen.getByRole("button", { name: "Add" });
    expect(add).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox", { name: "New tag name" }), "Later");
    expect(add).toBeEnabled();
    await userEvent.click(within(screen.getByRole("radiogroup", { name: "Tag colour" })).getByRole("radio", { name: "Purple" }));
    await userEvent.click(add);
    expect(store.getState().tags.find((t) => t.name === "Later")!.colour).toBe("c3");
    await userEvent.type(screen.getByRole("textbox", { name: "New tag name" }), "later");
    expect(await screen.findByRole("alert")).toHaveTextContent("You already have a tag called Later.");
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    expect(store.getState().tags.filter((t) => t.name.toLowerCase() === "later")).toHaveLength(1);
    await userEvent.clear(screen.getByRole("textbox", { name: "New tag name" }));
    // Rename edits in place.
    expect(screen.queryByRole("textbox", { name: "Name of tag Errands" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Rename tag Errands" }));
    const name = screen.getByRole("textbox", { name: "Name of tag Errands" });
    await userEvent.clear(name);
    await userEvent.type(name, "Shopping{Enter}");
    expect(store.getState().tags.find((t) => t.id === tag.id)!.name).toBe("Shopping");
    // Recolour from the swatch.
    await userEvent.click(screen.getByRole("button", { name: "Colour of Shopping" }));
    await userEvent.click(within(screen.getByRole("radiogroup", { name: "Colour of Shopping" })).getByRole("radio", { name: "Green" }));
    expect(store.getState().tags.find((t) => t.id === tag.id)!.colour).toBe("c2");

    expect(screen.queryByText("Deleted tags")).toBeNull(); // not drawn while none is deleted (p-set-tags-deleted-empty)
    await userEvent.click(screen.getByRole("button", { name: "Delete tag Shopping" }));
    expect(screen.getByText("Deleted tags")).toBeInTheDocument();
    expect(screen.getByText(/^Deleted \d+ \w{3}$/)).toBeInTheDocument();
    expect(screen.getByText("Restoring a tag puts it back on its tasks. Deleted tags are kept for 30 days.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Restore tag Shopping" }));
    expect(store.getState().tags.find((t) => t.id === tag.id)!.deletedAt).toBeNull();
    expect(store.getState().tasks.find((t) => t.id === mail.id)!.tags).toEqual([tag.id]);
    expect(await screen.findByText("Tag restored")).toBeInTheDocument(); // the toast (p-set-tags-restored)
    expect(screen.queryByText("Deleted tags")).toBeNull();
  });

  it("Settings · Tags with no tags says where tags come from, and still has the Add row and the footnote (p-set-tags-empty)", async () => {
    await open("/settings");
    await userEvent.click(await screen.findByRole("button", { name: "Tags" }));
    expect(screen.getByText("No tags yet.")).toBeInTheDocument();
    expect(screen.getByText("Add one above, or from a task. It appears here, where you can rename it, change its colour or delete it.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "New tag name" })).toBeInTheDocument();
    expect(screen.getByText("Deleting a tag hides it. You can restore it for 30 days.")).toBeInTheDocument();
  });

  it("a task at the tag limit can't be given another: the unticked tags and Create tag are disabled or go, and come back when one is unticked", async () => {
    // The limit is 100; the panel only compares a count with it, so the page is built with a limit of 3 (see the mock above) and not 100 chips.
    await open("/tasks", (store, water) => {
      for (let i = 0; i < 3; i++) store.setTaskTag(water.id, store.addTag(`Tag ${i}`, "c1").id, true);
      store.addTag("One more", "c2");
    });
    await userEvent.click(await screen.findByText("water plants"));
    const panel = screen.getByLabelText("Task", { selector: "aside" });
    const dialog = await openTags(panel);
    expect(within(dialog).getByText("A task can have 3 tags at most.")).toBeInTheDocument();
    expect(within(dialog).getByRole("checkbox", { name: "One more" })).toBeDisabled();
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Search tags" }), "brand new");
    expect(within(dialog).queryByRole("button", { name: /Create tag/ })).toBeNull();
    await userEvent.clear(within(dialog).getByRole("textbox", { name: "Search tags" }));
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Tag 0" }));
    expect(within(dialog).getByRole("checkbox", { name: "One more" })).toBeEnabled();
  });
});
