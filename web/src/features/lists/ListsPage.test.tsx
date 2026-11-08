import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { ClockProvider } from "../../app/clock";
import { LocalStore } from "../../store/LocalStore";
import { MemoryPersistence } from "../../store/persistence";
import { ListError } from "./ListsPage";

const NOW = new Date(2026, 10, 7, 10, 0);

async function open(path: string) {
  window.history.replaceState(null, "", path);
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
  const store = new LocalStore({ persistence: new MemoryPersistence(), now: () => NOW });
  await store.ready;
  render(
    <ClockProvider value={() => NOW}>
      <App store={store} />
    </ClockProvider>,
  );
  return store;
}

beforeEach(() => vi.unstubAllGlobals());

describe("Lists page", () => {
  it("shows Inbox first with open counts, and creates, renames and recolours a list", async () => {
    const store = await open("/lists");
    const inbox = store.getState().lists[0]!;
    act(() => {
      store.addTask({ title: "one" });
      store.addTask({ title: "two" });
      const done = store.addTask({ title: "three" });
      store.setDone(done.id, true);
    });

    const nav = screen.getByRole("navigation", { name: "Your lists" });
    const rows = () => within(nav).getAllByRole("button").map((b) => b.textContent);
    expect(rows()).toEqual(["Inbox2", "New list"]);
    expect(within(nav).getByLabelText("2 open")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "New list" }));
    await userEvent.type(screen.getByRole("textbox", { name: "New list name" }), "Home{Enter}");
    const home = store.getState().lists.find((l) => l.name === "Home")!;
    expect(home.isInbox).toBe(false);
    expect(rows()).toEqual(["Inbox2", "Home0", "New list"]);

    await userEvent.click(screen.getByRole("button", { name: "More" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    const name = screen.getByRole("textbox", { name: "List name" });
    await userEvent.clear(name);
    await userEvent.type(name, "House{Enter}");
    expect(store.getState().lists.find((l) => l.id === home.id)!.name).toBe("House");

    await userEvent.click(screen.getByRole("button", { name: "More" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Colour" }));
    await userEvent.click(screen.getByRole("radio", { name: "Purple" }));
    expect(store.getState().lists.find((l) => l.id === home.id)!.colour).toBe("c3");

    await userEvent.click(within(nav).getByRole("button", { name: /^Inbox/ }));
    expect(screen.getByRole("button", { name: "one" })).toBeInTheDocument();
    expect(inbox.isInbox).toBe(true);
    // The Inbox keeps its name and colour: its menu has only Completed and deleted.
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.queryByRole("menuitem", { name: "Rename" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Colour" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Completed and deleted" })).toHaveAttribute("href", "/completed");
  });
});

describe("Completed and deleted page", () => {
  it("lists completed tasks and puts a deleted task back", async () => {
    const store = await open("/completed");
    let b!: { id: string };
    act(() => {
      const a = store.addTask({ title: "finished" });
      store.setDone(a.id, true);
      const binned = store.addTask({ title: "binned" });
      store.deleteTask(binned.id);
      b = binned;
    });

    expect(await screen.findByRole("button", { name: "finished" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Deleted" }));
    expect(screen.getByText("binned")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Put back binned" }));
    expect(store.getState().tasks.find((t) => t.id === b.id)!.deletedAt).toBeNull();
    await waitFor(() => expect(screen.queryByText("binned")).not.toBeInTheDocument());
  });
});

describe("Lists states (Planner Designs p-lists-empty, p-lists-loading, p-lists-error, p-lists-offline)", () => {
  it("an empty list says so, offers Add a task, and the add field puts a task in that list", async () => {
    const store = await open("/lists");
    const errands = store.addList("Errands", "c4");
    await userEvent.click(await screen.findByRole("button", { name: /Errands/ }));
    expect(await screen.findByRole("heading", { name: "No tasks in Errands" })).toBeInTheDocument();
    expect(screen.getByText("Add the first one, or move a task here from another list.")).toBeInTheDocument();
    expect(screen.getByText("0 open")).toBeInTheDocument();
    const field = screen.getByRole("textbox", { name: "Add a task" });
    expect(field).toHaveAttribute("placeholder", "Add a task: Post the parcel tomorrow");
    await userEvent.type(field, "Post the parcel{Enter}");
    await waitFor(() => expect(store.getState().tasks.find((t) => t.title === "Post the parcel")?.listId).toBe(errands.id));
  });

  it("a task due tomorrow reads by its day in a list row (lists: Sun 8), and keeps the word on the Tasks page", async () => {
    const store = await open("/lists");
    act(() => {
      store.addTask({ title: "Birthday candles", due: "2026-11-08" });
    });
    expect(await screen.findByText("Sun 8")).toBeInTheDocument();
    expect(screen.queryByText("Tomorrow")).toBeNull();
  });

  it("offline, the sub line says so, and a row says its change has not left the device", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    try {
      const store = await open("/lists");
      act(() => {
        store.addTask({ title: "Lemons" });
      });
      expect(await screen.findByText("1 open · offline")).toBeInTheDocument();
      const notice = screen.getByText("You’re offline. Everything here is saved on this device and will sync when you’re back.");
      expect(notice.closest(".banner")).not.toBeNull(); // a banner above the rows with the cloud-off icon (p-lists-offline)
      expect(notice.querySelector("svg")).not.toBeNull();
      expect(document.querySelector(".ph .pillx")).toBeNull(); // the sync state is global, not part of the list header
      expect(screen.getByText("Not synced yet")).toBeInTheDocument();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("online, rows and the sub line say nothing about syncing", async () => {
    const store = await open("/lists");
    act(() => {
      store.addTask({ title: "Lemons" });
    });
    expect(await screen.findByText("1 open")).toBeInTheDocument();
    expect(screen.queryByText("Not synced yet")).toBeNull();
  });

  it("the error card says what failed and that the data is safe, with Open another list and Try again", async () => {
    const retry = vi.fn();
    const other = vi.fn();
    render(<ListError name="Errands" onRetry={retry} onOther={other} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn’t load Errands");
    expect(screen.getByText("The list is safe on your other devices. Check your connection and try again.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await userEvent.click(screen.getByRole("button", { name: "Open another list" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(other).toHaveBeenCalledTimes(1);
  });

  it("loading: the header and its actions stay, nothing shows for 400 ms, then Loading tasks and bars for the rows", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      window.history.replaceState(null, "", "/lists");
      vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
      const store = new LocalStore({ persistence: new MemoryPersistence(), now: () => NOW });
      await store.ready;
      const notReady = { ...store.getState(), ready: false }; // one object: a new one each call would loop
      const loading = Object.assign(Object.create(store) as LocalStore, { getState: () => notReady });
      render(<ClockProvider value={() => NOW}><App store={loading} /></ClockProvider>);
      expect(screen.getByRole("button", { name: "Add a task" })).toBeInTheDocument(); // the header stays
      expect(document.querySelector(".skel")).toBeNull();
      expect(screen.queryByText("Loading tasks")).toBeNull();
      await act(async () => void (await vi.advanceTimersByTimeAsync(450)));
      expect(screen.getByText("Loading tasks")).toHaveAttribute("role", "status");
      expect(document.querySelectorAll(".tbl .skel").length).toBeGreaterThanOrEqual(8); // four rows, two bars each
      expect(document.querySelector(".lists-loading .spin")).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("error: a list that is gone says so and offers Open another list and Try again, instead of quietly showing another list", async () => {
    window.history.replaceState(null, "", "/lists");
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    const store = new LocalStore({ persistence: new MemoryPersistence(), now: () => NOW });
    await store.ready;
    const home = store.addList("Home", "c4");
    // The planner as another device leaves it: the list the page was showing is no longer in it.
    let gone: ReturnType<LocalStore["getState"]> | null = null;
    const view = Object.assign(Object.create(store) as LocalStore, { getState: () => gone ?? store.getState() });
    render(<ClockProvider value={() => NOW}><App store={view} /></ClockProvider>);
    await userEvent.click(await screen.findByRole("button", { name: /^Home/ }));
    expect(screen.getByRole("region", { name: "Home" })).toBeInTheDocument();
    gone = { ...store.getState(), lists: store.getState().lists.filter((l) => l.id !== home.id) };
    act(() => void store.addTask({ title: "a change, so the page reads the planner again" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn’t load this list");
    expect(alert).toHaveClass("red-ring");
    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("alert")).toBeInTheDocument(); // still gone: it says so again
    await userEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Open another list" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("region", { name: "Inbox" })).toBeInTheDocument();
  });

  it("the header is the dot and name, the open count, Add a task and a … menu; clicking the name renames, and done tasks are not counted", async () => {
    const store = await open("/lists");
    const home = store.addList("Home", "c4");
    act(() => {
      store.addTask({ title: "open one", listId: home.id });
      const done = store.addTask({ title: "done one", listId: home.id });
      store.setDone(done.id, true);
    });
    await userEvent.click(await screen.findByRole("button", { name: /Home/ }));
    const header = document.querySelector(".ph")!;
    expect(within(header as HTMLElement).getByText("1 open")).toBeInTheDocument(); // the done row is not counted
    expect([...header.querySelectorAll(".acts button")].map((e) => e.getAttribute("aria-label") ?? e.textContent?.trim())).toEqual(["More", "Add a task"]);
    expect(within(header as HTMLElement).queryByRole("radiogroup", { name: "Colour" })).toBeNull(); // the colour row is in the menu
    expect(within(header as HTMLElement).queryByRole("link", { name: "Completed and deleted" })).toBeNull();
    await userEvent.click(within(header as HTMLElement).getByRole("button", { name: "Home" })); // the name
    const name = screen.getByRole("textbox", { name: "List name" });
    await userEvent.clear(name);
    await userEvent.type(name, "House{Enter}");
    expect(store.getState().lists.find((l) => l.id === home.id)!.name).toBe("House");
  });

  it("the … menu lists Rename, Colour and Completed and deleted; Escape closes it and focus returns to the button", async () => {
    const store = await open("/lists");
    store.addList("Home", "c4");
    await userEvent.click(await screen.findByRole("button", { name: /Home/ }));
    const more = screen.getByRole("button", { name: "More" });
    await userEvent.click(more);
    expect(within(screen.getByRole("menu", { name: "List menu" })).getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Rename", "Colour", "Completed and deleted"]);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu", { name: "List menu" })).toBeNull();
    expect(more).toHaveFocus();
  });
});
