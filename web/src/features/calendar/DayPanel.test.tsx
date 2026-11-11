import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClockProvider } from "../../state/clock";
import { LocalStore } from "../../data/local/LocalStore";
import { MemoryPersistence } from "../../data/local/persistence";
import { UiProvider, useUi } from "../../ui/product/UiProvider";
import { StoreProvider } from "../../state/store";
import { PrefsProvider } from "../../state/prefs";
import { DayPanel } from "./DayPanel";

const NOW = new Date(2026, 10, 7, 10, 0);

function Opener({ day }: { day: string }) {
  const ui = useUi();
  return <button type="button" onClick={() => ui.openDay(day)}>open</button>;
}

describe("Day agenda panel", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline")))));

  it("says nothing is on an empty day and goes back to the Calendar", async () => {
    const store = new LocalStore({ persistence: new MemoryPersistence(), now: () => NOW });
    await store.ready;
    render(
      <ClockProvider value={() => NOW}>
        <StoreProvider store={store}>
          <PrefsProvider>
            <UiProvider>
              <Opener day="2026-11-15" />
              <DayPanel />
            </UiProvider>
          </PrefsProvider>
        </StoreProvider>
      </ClockProvider>,
    );
    expect(screen.queryByRole("complementary", { name: "Day agenda" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "open" }));
    const panel = screen.getByRole("complementary", { name: "Day agenda" });
    expect(within(panel).getByText("Nothing on Sun 15 Nov.")).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole("button", { name: "Calendar" }));
    expect(screen.queryByRole("complementary", { name: "Day agenda" })).toBeNull();
  });

  it("lists the day's tasks and offers Add: an event or a task", async () => {
    const store = new LocalStore({ persistence: new MemoryPersistence(), now: () => NOW });
    await store.ready;
    act(() => {
      store.addTask({ title: "Order the printer ink", due: "2026-11-10", priority: "none" });
    });
    render(
      <ClockProvider value={() => NOW}>
        <StoreProvider store={store}>
          <PrefsProvider>
            <UiProvider>
              <Opener day="2026-11-10" />
              <DayPanel />
            </UiProvider>
          </PrefsProvider>
        </StoreProvider>
      </ClockProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "open" }));
    const panel = screen.getByRole("complementary", { name: "Day agenda" });
    expect(within(panel).getByText("1 task")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Order the printer ink" })).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole("button", { name: /Add/ }));
    expect(screen.getByRole("menuitem", { name: "Event" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Task" })).toBeInTheDocument();
  });
});
