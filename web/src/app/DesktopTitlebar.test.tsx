import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopTitlebar } from "./DesktopTitlebar";
import { registerDesktopSearch } from "./desktopShell";
import { useState } from "react";
import { Modal } from "../ui/primitives/Modal";

let invoke: ReturnType<typeof vi.fn>;
let releaseSearch: (() => void) | undefined;
beforeEach(() => {
  let maximized = false;
  invoke = vi.fn((_command: string, args: { action: string }) => {
    if (args.action === "toggle_maximize") maximized = !maximized;
    return Promise.resolve(maximized);
  });
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = { invoke };
});
afterEach(() => {
  releaseSearch?.();
  releaseSearch = undefined;
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

describe("Windows search-first titlebar", () => {
  it("keeps functional caption controls before planner/auth is mounted and disables search", async () => {
    render(<DesktopTitlebar />);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("desktop_shell", { action: "ready" }));
    expect(screen.getByRole("button", { name: "Search or add" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Minimize window" }));
    expect(invoke).toHaveBeenCalledWith("desktop_shell", { action: "minimize" });
    await userEvent.click(screen.getByRole("button", { name: "Maximize window" }));
    expect(await screen.findByRole("button", { name: "Restore window" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Restore window" }));
    expect(await screen.findByRole("button", { name: "Maximize window" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Close window" }));
    expect(invoke).toHaveBeenCalledWith("desktop_shell", { action: "close" });
  });

  it("opens the registered planner search exactly once and disables it on unmount", async () => {
    render(<DesktopTitlebar />);
    const open = vi.fn();
    act(() => { releaseSearch = registerDesktopSearch(open); });
    await userEvent.click(screen.getByRole("button", { name: "Search or add" }));
    expect(open).toHaveBeenCalledOnce();
    act(() => releaseSearch?.());
    expect(screen.getByRole("button", { name: "Search or add" })).toBeDisabled();
  });

  it("uses the native menu and restores keyboard focus to its opener", async () => {
    let finishMenu: (value: boolean) => void = () => undefined;
    invoke.mockImplementation((_command: string, args: { action: string }) => args.action === "menu"
      ? new Promise<boolean>((resolve) => { finishMenu = resolve; }) : Promise.resolve(false));
    render(<DesktopTitlebar />);
    const menu = screen.getByRole("button", { name: "Planner menu" });
    await userEvent.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    expect(invoke).toHaveBeenCalledWith("desktop_shell", { action: "menu" });
    await act(async () => finishMenu(false));
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(menu).toHaveFocus();
  });

  it("keeps app search inside the existing modal boundary while caption controls remain usable", async () => {
    const openSearch = vi.fn();
    releaseSearch = registerDesktopSearch(openSearch);
    function Example() {
      const [open, setOpen] = useState(true);
      return <><div id="root">Planner content</div><DesktopTitlebar />
        {open && <Modal label="Existing dialog" onClose={() => setOpen(false)}>
          <button type="button" onClick={() => setOpen(false)}>Done</button>
        </Modal>}</>;
    }
    render(<Example />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Search or add" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "Minimize window" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Close window" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Search or add" }));
    expect(openSearch).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Search or add" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Search or add" }));
    expect(openSearch).toHaveBeenCalledOnce();
  });

  it("drags only empty header space and double-clicks it to maximize", async () => {
    render(<DesktopTitlebar />);
    const header = screen.getByRole("banner", { name: "Window" });
    invoke.mockClear();
    fireEvent.mouseDown(screen.getByText("Planner"), { button: 0, detail: 1 });
    expect(invoke).not.toHaveBeenCalled();
    fireEvent.mouseDown(header, { button: 2, detail: 1 });
    expect(invoke).not.toHaveBeenCalled();
    fireEvent.mouseDown(header, { button: 0, detail: 1 });
    expect(invoke).toHaveBeenCalledWith("desktop_shell", { action: "drag" });
    fireEvent.mouseDown(header, { button: 0, detail: 2 });
    expect(invoke).toHaveBeenCalledWith("desktop_shell", { action: "toggle_maximize" });
    await screen.findByRole("button", { name: "Restore window" });
  });

  it("restores a native frame when readiness or a later control fails", async () => {
    invoke.mockRejectedValueOnce(new Error("frame setup failed"));
    render(<DesktopTitlebar />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Window controls unavailable.");
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("desktop_shell", { action: "fallback" }));
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    invoke.mockRejectedValueOnce(new Error("close failed"));
    await userEvent.click(screen.getByRole("button", { name: "Close window" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(invoke).toHaveBeenLastCalledWith("desktop_shell", { action: "fallback" });
  });
});
