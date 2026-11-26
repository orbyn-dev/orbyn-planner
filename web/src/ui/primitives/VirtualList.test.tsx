import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { focusRow } from "../../lib/focus";
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
    return { top: 0, left: 0, right: 300, bottom: height, width: 300, height, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
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
