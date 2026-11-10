import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { holdMemoryOnly } from "../lib/browserStorage";

let setDesktop: (desktop: boolean) => void;

beforeEach(() => {
  window.history.replaceState(null, "", "/today");
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
  const queries: Array<{ query: string; handlers: Set<(event: MediaQueryListEvent) => void> }> = [];
  let desktop = true;
  const matches = (query: string) => query.includes("max-width") ? !desktop : query.includes("min-width") ? desktop : false;
  vi.stubGlobal("matchMedia", (query: string) => {
    const handlers = new Set<(event: MediaQueryListEvent) => void>();
    queries.push({ query, handlers });
    return { get matches() { return matches(query); }, media: query,
      addEventListener: (_: string, handler: (event: MediaQueryListEvent) => void) => handlers.add(handler),
      removeEventListener: (_: string, handler: (event: MediaQueryListEvent) => void) => handlers.delete(handler) };
  });
  setDesktop = (value) => {
    desktop = value;
    for (const { query, handlers } of queries) {
      for (const handler of handlers) handler({ matches: matches(query), media: query } as MediaQueryListEvent);
    }
  };
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const pin = () => screen.getByRole("button", { name: "Pin sidebar open" });
async function collapse() {
  await userEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
  const side = screen.getByRole("complementary");
  act(() => screen.getByRole("main").focus());
  fireEvent.pointerLeave(side);
  return side;
}

describe("desktop sidebar rail", () => {
  it("starts pinned and retains every named destination when collapsed", async () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toHaveAttribute("aria-pressed", "true");
    await collapse();
    expect(pin()).toHaveAttribute("aria-expanded", "false");
    expect(pin()).toHaveAttribute("aria-pressed", "false");
    const nav = screen.getByRole("navigation", { name: "Primary" });
    for (const name of ["Today", "Tasks", "Calendar", "Lists", "Projects", "Notifications", "Settings"]) {
      expect(within(nav).getByRole("link", { name })).toBeInTheDocument();
    }
    expect(within(nav).getByRole("link", { name: "Today" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: /Search or add/ })).toBeEnabled();
  });

  it("peeks without persisting, and retains labels while focus remains inside", async () => {
    render(<App />);
    const side = await collapse();
    const writes = vi.spyOn(Storage.prototype, "setItem");
    fireEvent.pointerEnter(side, { pointerType: "mouse" });
    expect(pin()).toHaveAttribute("aria-expanded", "true");
    act(() => within(screen.getByRole("navigation", { name: "Primary" })).getByRole("link", { name: "Calendar" }).focus());
    fireEvent.pointerLeave(side, { pointerType: "mouse" });
    expect(pin()).toHaveAttribute("aria-expanded", "true");
    act(() => screen.getByRole("main").focus());
    expect(pin()).toHaveAttribute("aria-expanded", "false");
    expect(writes).not.toHaveBeenCalled();
  });

  it("Escape dismisses a peek and restores toggle focus without immediately reopening", async () => {
    render(<App />);
    const side = await collapse();
    fireEvent.pointerEnter(side, { pointerType: "mouse" });
    act(() => within(screen.getByRole("navigation", { name: "Primary" })).getByRole("link", { name: "Calendar" }).focus());
    await userEvent.keyboard("{Escape}");
    expect(pin()).toHaveFocus();
    expect(pin()).toHaveAttribute("aria-expanded", "false");
    fireEvent.pointerMove(side, { pointerType: "mouse" });
    expect(pin()).toHaveAttribute("aria-expanded", "false");
    fireEvent.pointerLeave(side, { pointerType: "mouse" });
    act(() => screen.getByRole("main").focus());
    fireEvent.pointerEnter(side, { pointerType: "mouse" });
    expect(pin()).toHaveAttribute("aria-expanded", "true");
  });

  it("Escape dismisses a pointer-only peek even while focus stays in the content", async () => {
    render(<App />);
    const side = await collapse();
    expect(screen.getByRole("main")).toHaveFocus();
    fireEvent.pointerEnter(side, { pointerType: "mouse" });
    expect(pin()).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{Escape}");
    expect(pin()).toHaveAttribute("aria-expanded", "false");
    expect(pin()).toHaveFocus();
  });

  it("keyboard focus alone reveals labels without requiring a pointer", async () => {
    render(<App />);
    await collapse();
    act(() => within(screen.getByRole("navigation", { name: "Primary" })).getByRole("link", { name: "Calendar" }).focus());
    expect(pin()).toHaveAttribute("aria-expanded", "true");
    expect(pin()).toHaveAttribute("aria-pressed", "false");
  });

  it("defaults to pinned for malformed saved preferences", () => {
    localStorage.setItem("orbyn-planner.sidebar", "unexpected");
    render(<App />);
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toHaveAttribute("aria-pressed", "true");
  });

  it("restores explicit collapse after remount and can pin from a peek", async () => {
    const app = render(<App />);
    await collapse();
    app.unmount();
    render(<App />);
    expect(pin()).toHaveAttribute("aria-expanded", "false");
    fireEvent.pointerEnter(screen.getByRole("complementary"), { pointerType: "mouse" });
    await userEvent.click(pin());
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the in-memory preference functional when storage is refused", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<App />);
    await collapse();
    expect(pin()).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(pin());
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toHaveAttribute("aria-pressed", "true");
  });

  it("does not write a sidebar preference to disk in memory-only mode", async () => {
    const release = holdMemoryOnly();
    try {
      render(<App />);
      const writes = vi.spyOn(Storage.prototype, "setItem");
      await collapse();
      expect(writes).not.toHaveBeenCalled();
    } finally { release(); }
  });

  it("drops transient expansion on phone widths and restores only the pinned choice", async () => {
    render(<App />);
    const side = await collapse();
    fireEvent.pointerEnter(side, { pointerType: "mouse" });
    expect(pin()).toHaveAttribute("aria-expanded", "true");
    act(() => setDesktop(false));
    expect(screen.queryByRole("button", { name: /Collapse sidebar|Pin sidebar open/ })).toBeNull();
    expect(screen.getByRole("navigation", { name: "Tabs" })).toBeInTheDocument();
    act(() => setDesktop(true));
    expect(pin()).toHaveAttribute("aria-expanded", "false");
    fireEvent.pointerEnter(side, { pointerType: "mouse" });
    expect(pin()).toHaveAttribute("aria-expanded", "true");
    fireEvent.pointerLeave(side, { pointerType: "mouse" });
    act(() => setDesktop(false));
    act(() => setDesktop(true));
    act(() => within(screen.getByRole("navigation", { name: "Primary" })).getByRole("link", { name: "Calendar" }).focus());
    expect(pin()).toHaveAttribute("aria-expanded", "true");
  });
});
