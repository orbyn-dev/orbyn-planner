import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UiProvider, useUi, useToasts } from "../ui/product/UiProvider";

afterEach(() => vi.useRealTimers());

describe("the toast dismiss timer", () => {
  it("does not render planner controls when only a toast changes", () => {
    let ui!: ReturnType<typeof useUi>;
    let renders = 0;
    function Controls() { ui = useUi(); renders++; return null; }
    render(<UiProvider><Controls /></UiProvider>);
    const initial = renders;
    act(() => ui.showToast("Marked done"));
    expect(renders).toBe(initial);
  });
  it("is cleared when the provider unmounts, so nothing fires after the page is gone", () => {
    vi.useFakeTimers();
    let ui!: ReturnType<typeof useUi> & ReturnType<typeof useToasts>;
    function Grab() {
      ui = { ...useUi(), ...useToasts() };
      return null;
    }
    const view = render(<UiProvider><Grab /></UiProvider>);
    act(() => ui.showToast("Task deleted"));
    const id = ui.toasts[0]!.id;
    act(() => ui.dismissToast(id)); // starts the timer that removes it once it has left
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("still removes the toast when the provider stays", () => {
    vi.useFakeTimers();
    let ui!: ReturnType<typeof useUi> & ReturnType<typeof useToasts>;
    function Grab() {
      ui = { ...useUi(), ...useToasts() };
      return null;
    }
    render(<UiProvider><Grab /></UiProvider>);
    act(() => ui.showToast("Task deleted"));
    act(() => ui.dismissToast(ui.toasts[0]!.id));
    act(() => void vi.advanceTimersByTime(500));
    expect(ui.toasts).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
