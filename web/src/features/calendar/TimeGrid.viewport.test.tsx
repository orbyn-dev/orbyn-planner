import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalStore } from "../../data/local/LocalStore";
import { MemoryPersistence } from "../../data/local/persistence";
import { expandEvents } from "../../core/planner/occurrences";
import { StoreProvider } from "../../state/store";
import { UiProvider } from "../../ui/product/UiProvider";
import { HOUR_PX } from "../../styles/tokens";
import { TimeGrid } from "./TimeGrid";

const DAY = "2026-11-06";
const NEXT = "2026-11-07";
const NOW = new Date(2026, 10, 6, 10);
let store: LocalStore;

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) { return this.classList.contains("calscroll") ? 200 : 0; });
  vi.stubGlobal("ResizeObserver", class {
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) { queueMicrotask(() => this.callback([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver)); }
    disconnect() {}
    unobserve() {}
  });
});
afterEach(() => { cleanup(); store?.close(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function open(days = [DAY]) {
  store = new LocalStore({ persistence: new MemoryPersistence(), broadcast: false, now: () => NOW });
  await store.ready;
  for (const day of days) {
    store.addEvent({ title: `${day} Morning`, start: `${day}T09:00`, end: `${day}T10:00` });
    store.addEvent({ title: `${day} Evening`, start: `${day}T20:00`, end: `${day}T21:00` });
  }
  const occurrences = expandEvents(store.getState().events, days[0]!, days.at(-1)!);
  const view = render(<StoreProvider store={store}><UiProvider>
    <button>Before calendar</button>
    <TimeGrid days={days} occurrences={occurrences} today={DAY} now={NOW} mode={days.length === 1 ? "day" : "week"} side={false} />
    <button>After calendar</button>
  </UiProvider></StoreProvider>);
  const port = view.container.querySelector<HTMLDivElement>(".calscroll")!;
  // This also proves a real measured viewport was published; a null viewport mounts every event.
  await waitFor(() => expect(screen.queryByRole("button", { name: new RegExp(`${DAY} Evening`) })).toBeNull());
  expect(port.clientHeight).toBe(200);
  expect(port.scrollTop).toBe(7 * HOUR_PX);
  return port;
}

describe("timed calendar events outside the measured viewport", () => {
  it("Tabs through every logical event and Shift-Tabs back before leaving the grid", async () => {
    const port = await open();
    const slot = screen.getByRole("button", { name: /Friday 6, 9:00\. Enter adds an event/ });
    act(() => slot.focus());
    await userEvent.tab();
    expect(screen.getByRole("button", { name: /2026-11-06 Morning/ })).toHaveFocus();
    await userEvent.tab();
    await waitFor(() => expect(screen.getByRole("button", { name: /2026-11-06 Evening/ })).toHaveFocus());
    expect(port.scrollTop).toBe(20 * HOUR_PX);
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "After calendar" })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("button", { name: /2026-11-06 Evening/ })).toHaveFocus();
    await userEvent.tab({ shift: true });
    await waitFor(() => expect(screen.getByRole("button", { name: /2026-11-06 Morning/ })).toHaveFocus());
    expect(port.scrollTop).toBe(9 * HOUR_PX);
    await userEvent.tab({ shift: true });
    expect(slot).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Before calendar" })).toHaveFocus();
  });

  it("keeps the original per-day event order across columns and preserves slot arrow controls", async () => {
    await open([DAY, NEXT]);
    const slot = screen.getByRole("button", { name: /Friday 6, 9:00\. Enter adds an event/ });
    act(() => slot.focus());
    fireEvent.keyDown(slot, { key: "ArrowDown" });
    const nextHour = screen.getByRole("button", { name: /Friday 6, 10:00\. Enter adds an event/ });
    expect(nextHour).toHaveFocus();
    expect(nextHour).toHaveAttribute("tabindex", "0");
    for (const title of [`${DAY} Morning`, `${DAY} Evening`, `${NEXT} Morning`, `${NEXT} Evening`]) {
      await userEvent.tab();
      await waitFor(() => expect(screen.getByRole("button", { name: new RegExp(title) })).toHaveFocus());
    }
    await userEvent.tab({ shift: true });
    await waitFor(() => expect(screen.getByRole("button", { name: new RegExp(`${NEXT} Morning`) })).toHaveFocus());
  });

  it("enters at the last logical event with Shift-Tab even when only morning events are mounted", async () => {
    const port = await open();
    act(() => screen.getByRole("button", { name: "After calendar" }).focus());
    expect(screen.queryByRole("button", { name: /2026-11-06 Evening/ })).toBeNull();
    await userEvent.tab({ shift: true });
    await waitFor(() => expect(screen.getByRole("button", { name: /2026-11-06 Evening/ })).toHaveFocus());
    expect(port.scrollTop).toBe(20 * HOUR_PX);
    act(() => screen.getByRole("button", { name: "Before calendar" }).focus());
    await userEvent.tab();
    expect(screen.getByRole("button", { name: /Friday 6, 9:00\. Enter adds an event/ })).toHaveFocus();
    expect(port.scrollTop).toBe(9 * HOUR_PX);
  });

  it("keeps explicit pointer and programmatic focus destinations", async () => {
    await open();
    act(() => screen.getByRole("button", { name: "After calendar" }).focus());
    const morning = screen.getByRole("button", { name: /2026-11-06 Morning/ });
    await userEvent.click(morning);
    expect(morning).toHaveFocus();
    act(() => screen.getByRole("button", { name: "After calendar" }).focus());
    act(() => morning.focus());
    expect(morning).toHaveFocus();
  });
});
