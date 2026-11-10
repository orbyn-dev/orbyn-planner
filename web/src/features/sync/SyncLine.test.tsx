import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SYNC_STATE_MIN_MS, SyncLine, useSyncStatus, withPersistence, type SyncStatus } from "./SyncLine";

const cases: [SyncStatus, string][] = [
  [{ kind: "synced", devices: 2 }, "Synced · 2 devices"],
  [{ kind: "synced", devices: 1 }, "Synced · this device"],
  [{ kind: "local" }, "On this device"],
  [{ kind: "syncing" }, "Syncing"],
  [{ kind: "offline", waiting: 3 }, "Offline · 3 changes waiting"],
  [{ kind: "offline", waiting: 1 }, "Offline · 1 change waiting"],
  [{ kind: "error" }, "Couldn’t sync"],
  [{ kind: "unsaved", reason: "This device is out of storage." }, "Couldn’t save on this device"],
  [{ kind: "memory" }, "Not saved on this device"],
];

describe("SyncLine", () => {
  it.each(cases)("renders %j", (status, text) => {
    render(<SyncLine status={status} />);
    expect(screen.getByRole("status")).toHaveTextContent(text);
    const retry = screen.queryByRole("button", { name: "Retry" });
    if (status.kind === "error") expect(retry).toBeInTheDocument();
    else expect(retry).not.toBeInTheDocument();
  });

  it("says just Offline when nothing is waiting", () => {
    render(<SyncLine status={{ kind: "offline", waiting: 0 }} />);
    expect(screen.getByRole("status").textContent).toBe("Offline");
  });

  it("Syncing is the blue dot pill and Couldn’t sync the red one, with a ghost Retry beside it", () => {
    const { unmount } = render(<SyncLine status={{ kind: "syncing" }} />);
    expect(screen.getByRole("status")).toHaveClass("st", "info");
    expect(screen.getByRole("status").querySelector(".sd")).not.toBeNull();
    unmount();
    render(<SyncLine status={{ kind: "error" }} onRetry={() => undefined} />);
    expect(screen.getByRole("status")).toHaveClass("st", "err");
    expect(screen.getByRole("button", { name: "Retry" })).toHaveClass("ghost");
    expect(screen.getByRole("status")).not.toContainElement(screen.getByRole("button", { name: "Retry" }));
  });

  it("the offline list says change or changes by the count, and ends with when it last synced", async () => {
    const one = [{ id: "t1", label: "Pick up dry cleaning", at: "2026-11-07T09:41:00" }];
    const { unmount } = render(<SyncLine status={{ kind: "offline", waiting: 1, lastSynced: "2026-11-07T09:38:00" }} waiting={one} />);
    await userEvent.click(screen.getByRole("button", { name: /Offline/ }));
    const list = screen.getByRole("region", { name: "Waiting to sync" });
    expect(list).toHaveTextContent("Your change is saved here and reaches your other devices as soon as you’re back online.");
    expect(list).toHaveTextContent("Last synced09:38");
    unmount();
    render(<SyncLine status={{ kind: "offline", waiting: 2 }} waiting={[...one, { id: "t2", label: "x", at: "2026-11-07T09:42:00" }]} />);
    await userEvent.click(screen.getByRole("button", { name: /Offline/ }));
    expect(screen.getByRole("region", { name: "Waiting to sync" })).toHaveTextContent("Your changes are saved here and reach your other devices");
    expect(screen.queryByText("Last synced")).toBeNull(); // never synced: nothing to say
  });

  it("on a phone the offline pill reads waiting to sync", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
    try {
      render(<SyncLine status={{ kind: "offline", waiting: 2 }} />);
      expect(screen.getByRole("status")).toHaveTextContent("Offline · 2 changes waiting to sync");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("calls onRetry", async () => {
    const onRetry = vi.fn();
    render(<SyncLine status={{ kind: "error" }} onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

function Probe() {
  const { status } = useSyncStatus();
  return <SyncLine status={status} />;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useSyncStatus", () => {
  it("shows browser offline and returns to local when online", async () => {
    vi.useFakeTimers();
    render(<Probe />);
    expect(screen.getByRole("status")).toHaveTextContent("On this device");
    act(() => window.dispatchEvent(new Event("offline")));
    await act(async () => { await vi.advanceTimersByTimeAsync(SYNC_STATE_MIN_MS); });
    expect(screen.getByRole("status")).toHaveTextContent("Offline");
    act(() => window.dispatchEvent(new Event("online")));
    await act(async () => { await vi.advanceTimersByTimeAsync(SYNC_STATE_MIN_MS); });
    expect(screen.getByRole("status")).toHaveTextContent("On this device");
  });
});

describe("SyncLine holds each state for a second (Motion Designs syncline)", () => {
  it("a Syncing that is replaced at once stays until it has been shown for a second, and the label is drawn fresh", async () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(<SyncLine status={{ kind: "syncing" }} />);
      const first = screen.getByRole("status");
      rerender(<SyncLine status={{ kind: "synced", devices: 2 }} />);
      expect(screen.getByRole("status")).toHaveTextContent("Syncing");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(999);
      });
      expect(screen.getByRole("status")).toHaveTextContent("Syncing");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2);
      });
      expect(screen.getByRole("status")).toHaveTextContent("Synced · 2 devices");
      expect(screen.getByRole("status")).not.toBe(first); // a new element: it fades in
    } finally {
      vi.useRealTimers();
    }
  });

  it("a change inside the same state shows at once", () => {
    const { rerender } = render(<SyncLine status={{ kind: "offline", waiting: 1 }} />);
    rerender(<SyncLine status={{ kind: "offline", waiting: 2 }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Offline · 2 changes waiting");
  });
});

describe("withPersistence", () => {
  it("puts storage trouble ahead of every other state", () => {
    const offline: SyncStatus = { kind: "offline", waiting: 2 };
    expect(withPersistence(offline, { status: "ok" })).toBe(offline);
    expect(withPersistence(offline, { status: "memory" })).toEqual({ kind: "memory" });
    expect(withPersistence(offline, { status: "failed", reason: "Full" })).toEqual({ kind: "unsaved", reason: "Full" });
  });

  it("the unsaved pill is red and never claims the changes are saved", () => {
    render(<SyncLine status={{ kind: "unsaved", reason: "This device is out of storage." }} />);
    const pill = screen.getByRole("status");
    expect(pill).toHaveClass("red");
    expect(pill.textContent).not.toMatch(/saved here|are saved/i);
    expect(pill).toHaveTextContent("This device is out of storage.");
  });
});
