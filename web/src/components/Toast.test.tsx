import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_TOASTS, TOAST_MS, TOAST_UNDO_MS, UiProvider, useUi } from "../app/ui";
import { Toast } from "./Toast";

// The app's one toast (Planner Designs v54 p-toast-states, p-toast-phone).
const api: { current: ReturnType<typeof useUi> | null } = { current: null };
const ui = { showToast: (...a: Parameters<ReturnType<typeof useUi>["showToast"]>) => api.current!.showToast(...a) };
function Harness() {
  const value = useUi();
  useEffect(() => {
    api.current = value;
  });
  return null;
}
function show() {
  return render(
    <UiProvider>
      <Harness />
      <Toast />
    </UiProvider>,
  );
}
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

afterEach(() => vi.useRealTimers());

describe("the toast", () => {
  it("is a polite live region, and a toast has an icon, its text and Undo as a ghost button", () => {
    show();
    act(() => ui.showToast("Moved to Blocked", () => undefined));
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    const toast = region.querySelector(".toast")!;
    expect(toast.querySelector("svg.ic")).not.toBeNull();
    expect(toast).toHaveTextContent("Moved to Blocked");
    expect(screen.getByRole("button", { name: "Undo" })).toHaveClass("ghost");
  });

  it("stays four seconds, five with Undo", async () => {
    vi.useFakeTimers();
    show();
    expect([TOAST_MS, TOAST_UNDO_MS]).toEqual([4_000, 5_000]);
    act(() => ui.showToast("Plain"));
    act(() => ui.showToast("With undo", () => undefined));
    await tick(TOAST_MS - 100);
    expect(screen.getByText("Plain")).toBeInTheDocument();
    await tick(400);
    expect(screen.queryByText("Plain")).toBeNull();
    expect(screen.getByText("With undo")).toBeInTheDocument();
    await tick(TOAST_UNDO_MS - TOAST_MS);
    expect(screen.queryByText("With undo")).toBeNull();
  });

  it("is not restarted by other renders: the clock runs from when it appeared", async () => {
    vi.useFakeTimers();
    show();
    act(() => ui.showToast("First"));
    await tick(3_000);
    act(() => ui.showToast("Second")); // the provider renders again
    await tick(1_300);
    expect(screen.queryByText("First")).toBeNull();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("shows three at most, the newest at the bottom", () => {
    show();
    for (const n of ["one", "two", "three", "four"]) act(() => ui.showToast(n));
    expect(MAX_TOASTS).toBe(3);
    expect(Array.from(document.querySelectorAll(".toast")).map((t) => t.textContent)).toEqual(["two", "three", "four"]);
  });

  it("Escape dismisses the newest, and it leaves with the exit animation first", async () => {
    vi.useFakeTimers();
    show();
    act(() => ui.showToast("one"));
    act(() => ui.showToast("two"));
    act(() => { fireEvent.keyDown(document, { key: "Escape" }); });
    expect(document.querySelectorAll(".toast")[1]).toHaveAttribute("data-leaving", "true");
    await tick(300);
    expect(screen.queryByText("two")).toBeNull();
    expect(screen.getByText("one")).toBeInTheDocument();
  });

  it("the exit is about 70 percent of the entrance, and reduced motion only fades", async () => {
    const nodeFs = "node:fs";
    const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync(path: string, encoding: "utf8"): string };
    const css = fs.readFileSync(`${(globalThis as { process?: { cwd(): string } }).process!.cwd()}/src/styles/app.css`, "utf8");
    expect(css).toMatch(/\.toast \{[^}]*animation: m-toast-in var\(--m-fast\)/);
    expect(css).toMatch(/\.toast\[data-leaving="true"\] \{ animation: m-toast-out calc\(var\(--m-fast\) \* \.7\)/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.toast \{ animation-name: m-fade; \}/);
    // Desktop: bottom right, 12 px from the edges. Phone: bottom centre above the tab bar, 16 px gutters.
    expect(css).toMatch(/\.toast-live \{ position: fixed; right: var\(--sp-12\); bottom: var\(--sp-12\)/);
    expect(css).toMatch(/\.toast-live \{ left: var\(--sp-16\); right: var\(--sp-16\);[^}]*env\(safe-area-inset-bottom\)/);
    // The card follows the theme: the page surface, never the inverted button colours.
    expect(css).toMatch(/\.toast \{[^}]*background: var\(--main\); color: var\(--t1\)/);
  });
});

describe("one toast, and no errors in it", () => {
  const nodeFs = "node:fs";
  async function sources() {
    const fs = (await import(/* @vite-ignore */ nodeFs)) as {
      readFileSync(path: string, encoding: "utf8"): string;
      readdirSync(path: string, o: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
    };
    const root = `${(globalThis as { process?: { cwd(): string } }).process!.cwd()}/src`;
    const out: { file: string; text: string }[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) out.push({ file: full.slice(root.length + 1), text: fs.readFileSync(full, "utf8") });
      }
    };
    walk(root);
    return out;
  }

  it("only Toast.tsx draws a toast", async () => {
    const drawn = (await sources()).filter((s) => /className="toast["\s]/.test(s.text)).map((s) => s.file);
    expect(drawn).toEqual(["components/Toast.tsx"]);
  });

  it("no toast says something failed: errors stay in a banner beside what failed", async () => {
    const calls = (await sources()).flatMap((s) => [...s.text.matchAll(/showToast\(\s*([`"][^`"]*[`"])/g)].map((m) => `${s.file}: ${m[1]}`));
    expect(calls.length).toBeGreaterThan(10);
    expect(calls.filter((c) => /couldn.t|can.t|cannot|failed|error|didn.t work|try again|went wrong/i.test(c))).toEqual([]);
  });
});
