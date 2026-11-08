import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { ClockProvider } from "../../app/clock";
import { LocalStore } from "../../store/LocalStore";
import { MemoryPersistence } from "../../store/persistence";
import { repeatEvery } from "../../store/repeat";

// Saturday 7 November 2026, 10:00.
const NOW = new Date(2026, 10, 7, 10, 0);

async function openBoard(seed: (s: LocalStore) => void, path = "/tasks") {
  window.history.replaceState(null, "", path);
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
  const store = new LocalStore({ persistence: new MemoryPersistence(), now: () => NOW, broadcast: false });
  await store.ready;
  seed(store);
  const root = document.createElement("div");
  root.id = "root";
  document.body.appendChild(root);
  render(
    <ClockProvider value={() => NOW}>
      <App store={store} />
    </ClockProvider>,
    { container: root },
  );
  if (path === "/tasks") await userEvent.click(await screen.findByRole("radio", { name: "Board" }));
  return store;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  document.getElementById("root")?.remove();
});

const lane = (name: string) => screen.getByRole("region", { name });
const dataTransfer = () => {
  const data: Record<string, string> = {};
  return { setData: (k: string, v: string) => (data[k] = v), getData: (k: string) => data[k] ?? "", effectAllowed: "" };
};
/** Drag a card to a lane, as a pointer does. */
function drag(card: HTMLElement, to: HTMLElement) {
  const dt = dataTransfer();
  fireEvent.dragStart(card, { dataTransfer: dt });
  fireEvent.dragOver(to, { dataTransfer: dt });
  fireEvent.drop(to, { dataTransfer: dt });
}
const seed = (s: LocalStore) => {
  s.addTask({ title: "Prepare the slides" });
  const progress = s.addTask({ title: "Launch brief" });
  s.updateTask(progress.id, { status: "in_progress" });
  const blocked = s.addTask({ title: "Book a table" });
  s.updateTask(blocked.id, { status: "blocked" });
  const done = s.addTask({ title: "Reply to the school" });
  s.updateTask(done.id, { status: "in_progress" });
  s.setDone(done.id, true);
};

describe("the Tasks board lanes (task status)", () => {
  it("has the four lanes To do, In progress, Blocked and Done, and each card is in the lane its status names", async () => {
    await openBoard(seed);
    const titles = (name: string) => within(lane(name)).getAllByRole("listitem").map((c) => within(c).getByRole("button", { name: /^(?!Move|More)/ }).textContent);
    expect(document.querySelectorAll(".board .lane")).toHaveLength(4);
    expect(titles("To do")).toEqual(["Prepare the slides"]);
    expect(titles("In progress")).toEqual(["Launch brief"]);
    expect(titles("Blocked")).toEqual(["Book a table"]);
    expect(titles("Done")).toEqual(["Reply to the school"]); // done wins over the status it keeps
    expect(within(lane("Blocked")).getByRole("heading")).toHaveTextContent("Blocked1");
  });

  it("dropping a card in another open lane writes only its status", async () => {
    const store = await openBoard(seed);
    const card = within(lane("To do")).getByRole("listitem");
    drag(card, lane("In progress"));
    const task = store.getState().tasks.find((t) => t.title === "Prepare the slides")!;
    expect(task).toMatchObject({ status: "in_progress", done: false });
    expect(screen.getByText("Moved to In progress.")).toBeInTheDocument(); // a quiet toast for every move, with Undo
    expect(within(lane("In progress")).getAllByRole("listitem")).toHaveLength(2);
  });

  it("dropping a card in Done marks it done and keeps its status; Undo restores it exactly", async () => {
    const store = await openBoard(seed);
    drag(within(lane("Blocked")).getByRole("listitem"), lane("Done"));
    const task = () => store.getState().tasks.find((t) => t.title === "Book a table")!;
    expect(task()).toMatchObject({ status: "blocked", done: true });
    expect(task().completedAt).not.toBeNull();
    expect(screen.getByText("Marked done.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(task()).toMatchObject({ status: "blocked", done: false, completedAt: null });
  });

  it("dragging out of Done: no longer done, takes the lane's status, and the toast reads Moved “…” to In progress with Undo", async () => {
    const store = await openBoard(seed);
    const task = () => store.getState().tasks.find((t) => t.title === "Reply to the school")!;
    const before = { status: task().status, done: task().done, completedAt: task().completedAt };
    expect(before).toMatchObject({ status: "in_progress", done: true });
    drag(within(lane("Done")).getByRole("listitem"), lane("Blocked"));
    expect(task()).toMatchObject({ status: "blocked", done: false, completedAt: null });
    expect(screen.getByText("Moved “Reply to the school” to Blocked.")).toBeInTheDocument();
    // Undo puts status, done and the done time back, in one write.
    const update = vi.spyOn(store, "updateTask");
    await act(async () => userEvent.click(screen.getByRole("button", { name: "Undo" })));
    const writes = update.mock.calls.length;
    expect(update.mock.calls[0]![1]).toMatchObject({ status: "in_progress", done: true }); // all three fields in the one write
    expect({ status: task().status, done: task().done, completedAt: task().completedAt }).toEqual(before);
    expect(writes).toBe(1);
  });

  it("an unknown status shows in To do, and moving a card to the lane it is in writes nothing", async () => {
    const store = await openBoard((s) => s.updateTask(s.addTask({ title: "Odd" }).id, { status: "waiting_on_review" }));
    expect(within(lane("To do")).getByRole("button", { name: "Odd" })).toBeInTheDocument();
    drag(within(lane("To do")).getByRole("listitem"), lane("To do"));
    expect(store.getState().tasks[0]!.status).toBe("waiting_on_review");
  });

  it("the lane a card would land in is outlined with Drop to move to … while it is dragged", async () => {
    await openBoard(seed);
    const dt = dataTransfer();
    fireEvent.dragStart(within(lane("To do")).getByRole("listitem"), { dataTransfer: dt });
    fireEvent.dragOver(lane("Blocked"), { dataTransfer: dt });
    expect(lane("Blocked")).toHaveClass("drop");
    expect(within(lane("Blocked")).getByText("Drop to move to Blocked")).toBeInTheDocument();
    fireEvent.dragEnd(within(lane("To do")).getByRole("listitem"));
  });

  it("the … menu is the keyboard way, and a repeating task moved to Done goes to its next date in To do", async () => {
    const store = await openBoard((s) => {
      const bins = s.addTask({ title: "Bins", due: "2026-11-09", repeat: repeatEvery("weekly") });
      s.updateTask(bins.id, { status: "blocked" });
    });
    await userEvent.click(within(lane("Blocked")).getByRole("button", { name: "More for Bins" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Move to/ }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Done" }));
    expect(store.getState().tasks[0]).toMatchObject({ due: "2026-11-16", done: false, status: "todo" });
    expect(within(lane("To do")).getByRole("button", { name: "Bins" })).toBeInTheDocument();
  });

  it("View options › Show Done lane hides the Done lane", async () => {
    await openBoard(seed);
    await userEvent.click(screen.getByRole("button", { name: "View options" }));
    await userEvent.click(screen.getByRole("switch", { name: "Show Done lane" }));
    expect(document.querySelectorAll(".board .lane")).toHaveLength(3);
  });
});

describe("the project board (project-board-no-sections)", () => {
  it("a project with no sections has one Tasks lane holding every open task, then Done; Blocked is the word on a card", async () => {
    let id = "";
    await openBoard((s) => {
      const p = s.addProject({ name: "Home renovation", colour: "c3" });
      id = p.id;
      s.updateTask(s.addTask({ title: "Choose tiles", projectId: p.id }).id, { status: "in_progress" });
      s.updateTask(s.addTask({ title: "Plumbing quotes", projectId: p.id }).id, { status: "blocked" });
      s.setDone(s.addTask({ title: "Measure", projectId: p.id }).id, true);
    }, "/projects");
    window.history.pushState(null, "", `/projects/${id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
    await userEvent.click(await screen.findByRole("tab", { name: "Board" }));
    expect([...document.querySelectorAll(".board .lane")].map((l) => l.getAttribute("aria-label"))).toEqual(["Tasks", "Done"]);
    const open = within(lane("Tasks")).getAllByRole("listitem").map((c) => c.textContent);
    expect(open.join("|")).toContain("Choose tiles");
    expect(open.join("|")).toContain("Plumbing quotes · Blocked");
    expect(within(lane("Done")).getByText("Measure")).toBeInTheDocument();
  });
});

describe("the board card's … menu (Planner Designs v52 p-board-card-menu, p-board-card-focus, p-board-card-moved)", () => {
  const card = (name: string) => screen.getByRole("listitem", { name: new RegExp(`^${name},`) });
  const task = (store: LocalStore, title: string) => store.getState().tasks.find((t) => t.title === title)!;

  it("a card is announced with its title, lane and place in the lane", async () => {
    await openBoard(seed);
    expect(card("Prepare the slides")).toHaveAccessibleName("Prepare the slides, in To do, 1 of 1");
    expect(card("Launch brief")).toHaveAccessibleName("Launch brief, in In progress, 1 of 1");
    expect(card("Reply to the school")).toHaveAccessibleName("Reply to the school, in Done, 1 of 1");
  });

  it("the … menu lists Open, Mark done and Move to, whose lanes are To do, In progress, Blocked and Done with the current one checked and disabled", async () => {
    await openBoard(seed);
    await userEvent.click(within(card("Launch brief")).getByRole("button", { name: "More for Launch brief" }));
    expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Open", "Mark done", "Move to›"]);
    await userEvent.click(screen.getByRole("menuitem", { name: /Move to/ }));
    expect(screen.getAllByRole("menuitemradio").map((m) => m.textContent)).toEqual(["To do", "In progressCurrent", "Blocked", "Done"]);
    const current = screen.getByRole("menuitemradio", { name: /^In progress/ });
    expect(current).toBeChecked();
    expect(current).toBeDisabled();
    expect(screen.getByRole("menuitemradio", { name: "To do" })).toBeEnabled();
  });

  it("the keyboard path: Enter opens the menu, the arrows move, Enter picks a lane, and Escape closes with focus back on the button", async () => {
    const store = await openBoard(seed);
    const more = within(card("Launch brief")).getByRole("button", { name: "More for Launch brief" });
    more.focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("menuitem", { name: "Open" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: /Move to/ })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("menuitemradio", { name: "To do" })).toHaveFocus(); // the current lane is skipped
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}"); // To do, then Blocked, then Done
    expect(task(store, "Launch brief")).toMatchObject({ done: true });
    // Escape: a menu opened again closes and focus returns to the … button.
    const again = within(card("Prepare the slides")).getByRole("button", { name: "More for Prepare the slides" });
    again.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(again).toHaveFocus();
  });

  it("Alt+Right and Alt+Left on a focused card move it one lane, and stop at the ends", async () => {
    const store = await openBoard(seed);
    card("Prepare the slides").focus();
    await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
    expect(task(store, "Prepare the slides")).toMatchObject({ status: "in_progress" });
    expect(card("Prepare the slides")).toHaveFocus(); // the moved card keeps focus (p-board-card-moved)
    await userEvent.keyboard("{Alt>}{ArrowLeft}{/Alt}{Alt>}{ArrowLeft}{/Alt}");
    expect(task(store, "Prepare the slides").status ?? "todo").toBe("todo");
    expect(laneOfTitle("To do", "Prepare the slides")).toBe(true); // at the first lane Alt+Left does nothing
  });

  it("a move says so in a polite live region (Moved “title” to Blocked, or Marked done) and shows a quiet toast with Undo", async () => {
    const store = await openBoard(seed);
    await userEvent.click(within(card("Prepare the slides")).getByRole("button", { name: "More for Prepare the slides" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Move to/ }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Blocked" }));
    const live = document.querySelector('[role="status"][aria-live="polite"]')!;
    expect(live).toHaveTextContent("Moved “Prepare the slides” to Blocked");
    expect(screen.getByText("Moved to Blocked.")).toHaveAttribute("aria-hidden", "true");
    expect(task(store, "Prepare the slides")).toMatchObject({ status: "blocked" });
    await userEvent.click(within(card("Launch brief")).getByRole("button", { name: "More for Launch brief" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Mark done" }));
    expect(live).toHaveTextContent("Marked done");
  });

  it("Undo puts the exact earlier state back", async () => {
    const store = await openBoard(seed);
    const before = JSON.stringify(task(store, "Launch brief"));
    card("Launch brief").focus();
    await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}"); // In progress to Blocked
    expect(task(store, "Launch brief")).toMatchObject({ status: "blocked" });
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(JSON.stringify(task(store, "Launch brief"))).toBe(before);
  });

  it("the old Move to link is gone", async () => {
    await openBoard(seed);
    expect(screen.queryByRole("button", { name: /^Move .* to$/ })).toBeNull();
  });
});

function laneOfTitle(laneName: string, title: string): boolean {
  return within(screen.getByRole("region", { name: laneName })).queryByRole("button", { name: title }) !== null;
}
