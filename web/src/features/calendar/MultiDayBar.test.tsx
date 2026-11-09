import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { ClockProvider } from "../../state/clock";
import { LocalStore } from "../../data/local/LocalStore";
import { MemoryPersistence } from "../../data/local/persistence";

// Saturday 7 November 2026, 10:00: the week view shows Monday 2 to Sunday 8.
const NOW = new Date(2026, 10, 7, 10, 0);

async function open(seed: (s: LocalStore) => void) {
  window.history.replaceState(null, "", "/calendar");
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
  const store = new LocalStore({ persistence: new MemoryPersistence(), now: () => NOW, broadcast: false });
  await store.ready;
  seed(store);
  render(
    <ClockProvider value={() => NOW}>
      <App store={store} />
    </ClockProvider>,
  );
  await screen.findByText("All day");
}

beforeEach(() => vi.unstubAllGlobals());

describe("a multi-day all-day event in the week view", () => {
  it("is one bar across the days it covers, labelled with its dates, not a chip in every column", async () => {
    await open((s) => {
      s.addEvent({ title: "Home renovation: tiling", allDay: true, start: "2026-11-03", end: "2026-11-05" });
      s.addEvent({ title: "Maya’s birthday", allDay: true, start: "2026-11-07", end: "2026-11-07" });
    });
    const bars = screen.getAllByRole("button", { name: /Home renovation: tiling/ });
    expect(bars).toHaveLength(1); // one bar
    expect(bars[0]).toHaveTextContent("Home renovation: tiling · Tue 3 to Thu 5");
    const cell = bars[0]!.parentElement!;
    expect(cell).toHaveClass("adb");
    expect(cell.style.gridColumn).toBe("3 / span 3"); // Tue, Wed and Thu: the first column is the hours, Monday is column 2
    expect(screen.getAllByRole("button", { name: "Maya’s birthday" })).toHaveLength(1); // a one-day event stays a chip in its column
    expect(screen.getByRole("button", { name: "Maya’s birthday" }).parentElement).toHaveClass("adc");
  });

  it("is cut to the days the week shows, but still says where it really starts and ends", async () => {
    await open((s) => s.addEvent({ title: "Conference", allDay: true, start: "2026-11-06", end: "2026-11-12" }));
    const bar = screen.getByRole("button", { name: /Conference/ });
    expect(bar).toHaveTextContent("Conference · Fri 6 to Thu 12");
    expect(bar.parentElement!.style.gridColumn).toBe("6 / span 3"); // Fri, Sat and Sun are what the week shows
  });
});
