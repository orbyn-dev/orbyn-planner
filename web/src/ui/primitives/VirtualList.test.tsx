import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { focusCard, focusRow } from "../../lib/focus";
import { VirtualList } from "./VirtualList";

type Item = { id: string; height: number };
const items: Item[] = Array.from({ length: 200 }, (_, i) => ({ id: `item-${i}`, height: i % 2 ? 48 : 32 }));
const key = (item: Item) => `task:${item.id}`;
const id = (item: Item) => item.id;
function List({ rows = items, pinnedKeys = [] }: { rows?: Item[]; pinnedKeys?: string[] }) {
  return <div data-testid="viewport" style={{ overflowY: "auto", height: "200px" }}>
    <VirtualList items={rows} getKey={key} getRowId={id} pinnedKeys={pinnedKeys} label="Tasks">
      {(item) => <li data-row-id={item.id}><button>{item.id}</button></li>}
    </VirtualList>
  </div>;
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) {
      const height = target instanceof HTMLElement && target.dataset.rowId
        ? items.find((item) => item.id === target.dataset.rowId)?.height ?? 40 : 200;
      queueMicrotask(() => this.callback([{ target, contentRect: { width: 300, height }, borderBoxSize: [{ inlineSize: 300, blockSize: height }] } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver));
    }
    unobserve() {}
    disconnect() {}
  });
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(200);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const height = this.dataset.rowId ? items.find((item) => item.id === this.dataset.rowId)?.height ?? 40 : 200;
    const top = this.tagName === "UL" ? -(this.parentElement?.scrollTop ?? 0) : 0;
    return { top, left: 0, right: 300, bottom: top + height, width: 300, height, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  });
  HTMLElement.prototype.scrollTo = function (options?: ScrollToOptions | number, y?: number) {
    this.scrollTop = typeof options === "number" ? y ?? 0 : options?.top ?? 0;
    this.dispatchEvent(new Event("scroll"));
  };
  vi.stubGlobal("CSS", { escape: (value: string) => value });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("VirtualList", () => {
  it("measures logical rows while a deleted row's motion ghost is still mounted", () => {
    const original = HTMLElement.prototype.animate;
    HTMLElement.prototype.animate = (() => ({ onfinish: null })) as unknown as typeof HTMLElement.prototype.animate;
    try {
      const view = render(<List rows={items.slice(0, 3)} />);
      expect(() => view.rerender(<List rows={[items[0]!, items[2]!]} />)).not.toThrow();
      expect(screen.getByRole("list", { name: "Tasks" }).querySelector('[aria-hidden="true"]')).not.toBeNull();
      expect(screen.getAllByRole("button")).toHaveLength(2);
    } finally {
      if (original) HTMLElement.prototype.animate = original;
      else delete (HTMLElement.prototype as { animate?: unknown }).animate;
    }
  });
  it("renders ordinary list markup for small lists", () => {
    render(<List rows={items.slice(0, 3)} />);
    const list = screen.getByRole("list", { name: "Tasks" });
    expect(list.querySelectorAll("li")).toHaveLength(3);
    expect(list.querySelector("[data-virtual-gap]")).toBeNull();
  });
  it("bounds mounted rows and reveals a raw entity id despite prefixed keys", async () => {
    render(<List />);
    expect(document.querySelectorAll("li[data-row-id]").length).toBeLessThan(50);
    expect(screen.queryByRole("button", { name: "item-150" })).toBeNull();
    act(() => focusRow("item-150"));
    await waitFor(() => expect(screen.getByRole("button", { name: "item-150" })).toHaveFocus());
    expect(screen.getByRole("button", { name: "item-150" }).closest("li")).toHaveAttribute("aria-posinset", "151");
  });
  it("retains focused and pinned rows while scrolling, including after reorder", async () => {
    const { rerender } = render(<List pinnedKeys={["task:item-180"]} />);
    const focused = screen.getByRole("button", { name: "item-0" });
    focused.focus();
    const port = screen.getByTestId("viewport");
    act(() => { port.scrollTop = 3000; fireEvent.scroll(port); });
    expect(screen.getByRole("button", { name: "item-0" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "item-180" })).toBeInTheDocument();
    rerender(<List rows={[...items].reverse()} pinnedKeys={["task:item-180"]} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "item-180" }).closest("li")).toHaveAttribute("aria-posinset", "20"));
  });
  it("moves Tab from the last mounted row to the logical next row", async () => {
    render(<List />);
    const rows = [...document.querySelectorAll<HTMLLIElement>("li[data-row-id]")];
    const last = rows.at(-1)!;
    const next = Number(last.dataset.index) + 1;
    const button = last.querySelector("button")!;
    button.focus();
    fireEvent.keyDown(button, { key: "Tab" });
    await waitFor(() => expect(screen.getByRole("button", { name: `item-${next}` })).toHaveFocus());
  });
});

it("clears virtual list ARIA when the list shrinks below the threshold", () => {
  const view = render(<List />);
  expect(screen.getByRole("button", { name: "item-0" }).closest("li")).toHaveAttribute("aria-setsize", "200");
  view.rerender(<List rows={items.slice(0, 3)} />);
  expect(screen.getByRole("button", { name: "item-0" }).closest("li")).not.toHaveAttribute("aria-setsize");
  expect(screen.getByRole("button", { name: "item-0" }).closest("li")).not.toHaveAttribute("aria-posinset");
});

it("Shift+Tab enters the preceding focusable card at its last descendant", async () => {
  render(<div style={{ overflowY: "auto" }}><VirtualList items={items} getKey={key}>{(item) => <li tabIndex={0} data-row-id={item.id}><button>{item.id} first</button><button>{item.id} last</button></li>}</VirtualList></div>);
  const firstButton = screen.getByRole("button", { name: "item-1 first" });
  const card = firstButton.closest("li")!;
  card.focus();
  fireEvent.keyDown(card, { key: "Tab", shiftKey: true });
  await waitFor(() => expect(screen.getByRole("button", { name: "item-0 last" })).toHaveFocus());
});

it("enters an entirely offscreen group from either Tab direction", async () => {
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const top = this.getAttribute("aria-label") === "Second" ? 2000 - (this.parentElement?.scrollTop ?? 0) : 0;
    return { top, left: 0, right: 300, bottom: top + 800, width: 300, height: 800, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  });
  const group = items.slice(100, 120);
  render(<div data-testid="port" style={{ overflowY: "auto" }}><VirtualList items={group} totalCount={200} getKey={key} label="Second">{(item) => <li data-row-id={item.id}><button>{item.id}</button></li>}</VirtualList></div>);
  const list = screen.getByRole("list", { name: "Second" });
  expect(list.querySelectorAll("li[data-row-id]")).toHaveLength(0);
  fireEvent.keyDown(document.body, { key: "Tab" });
  fireEvent.focus(list.querySelector<HTMLElement>('[data-virtual-gap][tabindex="0"]')!);
  await waitFor(() => expect(screen.getByRole("button", { name: "item-100" })).toHaveFocus());
  const port = screen.getByTestId("port");
  act(() => { port.scrollTop = 0; fireEvent.scroll(port); });
  fireEvent.blur(screen.getByRole("button", { name: "item-100" }));
  fireEvent.keyDown(document.body, { key: "Tab", shiftKey: true });
  fireEvent.focus(list.querySelector<HTMLElement>('[data-virtual-gap][tabindex="0"]')!);
  await waitFor(() => expect(screen.getByRole("button", { name: "item-119" })).toHaveFocus());
});

it("remeasures a group's offset when an earlier sibling shrinks", async () => {
  let top = 1000;
  const observers: { callback: ResizeObserverCallback; targets: Element[]; self: ResizeObserver }[] = [];
  vi.stubGlobal("ResizeObserver", class {
    private record: { callback: ResizeObserverCallback; targets: Element[]; self: ResizeObserver };
    constructor(callback: ResizeObserverCallback) { this.record = { callback, targets: [], self: this as unknown as ResizeObserver }; observers.push(this.record); }
    observe(target: Element) { this.record.targets.push(target); }
    unobserve() {}
    disconnect() {}
  });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(500);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const y = this.getAttribute("aria-label") === "Second" ? top : 0;
    return { top: y, left: 0, right: 300, bottom: y + 200, width: 300, height: 200, x: 0, y, toJSON: () => ({}) } as DOMRect;
  });
  const view = (before: boolean) => <div style={{ overflowY: "auto" }}>{before && <section key="previous" data-testid="previous" />}<section key="group"><VirtualList items={items.slice(100, 120)} totalCount={200} getKey={key} label="Second">{(item) => <li data-row-id={item.id}><button>{item.id}</button></li>}</VirtualList></section>{!before && <section key="previous" data-testid="previous" />}</div>;
  const { rerender } = render(view(true));
  const previous = screen.getByTestId("previous");
  expect(screen.queryByRole("button", { name: "item-100" })).toBeNull();
  top = 0;
  act(() => { for (const observer of observers) if (observer.targets.includes(previous)) observer.callback([{ target: previous, contentRect: { width: 300, height: 200 }, borderBoxSize: [{ inlineSize: 300, blockSize: 200 }] } as unknown as ResizeObserverEntry], observer.self); });
  await waitFor(() => expect(screen.getByRole("button", { name: "item-100" })).toBeInTheDocument());
  top = 1000;
  rerender(view(false));
  await waitFor(() => expect(screen.queryByRole("button", { name: "item-100" })).toBeNull());
  top = 0;
  rerender(view(true));
  await waitFor(() => expect(screen.getByRole("button", { name: "item-100" })).toBeInTheDocument());
});

it("preserves child ARIA through virtualization, including a value matching the computed position", () => {
  const provided = (rows: Item[], position: number) => <div style={{ overflowY: "auto" }}><VirtualList items={rows} getKey={key}>{(item) => <li data-row-id={item.id} aria-posinset={position} aria-setsize={777}><button>{item.id}</button></li>}</VirtualList></div>;
  const view = render(provided(items.slice(0, 3), 42));
  const row = () => screen.getByRole("button", { name: "item-0" }).closest("li")!;
  expect(row()).toHaveAttribute("aria-posinset", "42");
  expect(row()).toHaveAttribute("aria-setsize", "777");
  view.rerender(provided(items, 42));
  expect(row()).toHaveAttribute("aria-posinset", "42");
  expect(row()).toHaveAttribute("aria-setsize", "777");
  view.rerender(provided(items, 1));
  expect(row()).toHaveAttribute("aria-posinset", "1");
  view.rerender(provided(items.slice(0, 3), 1));
  expect(row()).toHaveAttribute("aria-posinset", "1");
  expect(row()).toHaveAttribute("aria-setsize", "777");
});


it("reveals and focuses a moved card in an offscreen virtualized destination after commit", async () => {
  const moved = { id: "moved-card", height: 40 };
  function Board() {
    const [done, setDone] = useState(false);
    return <div style={{ overflowY: "auto" }}>
      <button onClick={() => { setDone(true); focusCard(moved.id); }}>Move</button>
      <VirtualList label="Source" items={done ? [] : [moved]} totalCount={201} getKey={id}>{(item) => <li tabIndex={0} data-row-id={item.id}>{item.id}</li>}</VirtualList>
      <VirtualList label="Destination" items={done ? [...items, moved] : items} totalCount={201} getKey={id}>{(item) => <li tabIndex={0} data-row-id={item.id}>{item.id}</li>}</VirtualList>
    </div>;
  }
  render(<Board />);
  fireEvent.click(screen.getByRole("button", { name: "Move" }));
  await waitFor(() => expect(screen.getByText("moved-card")).toHaveFocus());
  expect(screen.getByText("moved-card").closest('[aria-label="Destination"]')).not.toBeNull();
});
