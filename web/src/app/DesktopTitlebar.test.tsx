import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopTitlebar } from "./DesktopTitlebar";
import { registerShellNavigation, runShellNavigation } from "./desktopShell";
import { registerSidebarControls } from "./sidebarControls";
import { Modal } from "../ui/primitives/Modal";

let invoke: ReturnType<typeof vi.fn>;
const cleanups: Array<() => void> = [];
beforeEach(() => {
  let maximized = false;
  invoke = vi.fn((_command: string, args: { action: string }) => {
    if (args.action === "toggle_maximize") maximized = !maximized;
    return Promise.resolve(maximized);
  });
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = { invoke };
});
afterEach(() => {
  act(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); });
  vi.restoreAllMocks();
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});
function registerApp() {
  const back = vi.fn();
  const forward = vi.fn();
  const toggle = vi.fn();
  const initial = { destination: "Projects", canGoBack: true, canGoForward: false, back, forward };
  const navigation = registerShellNavigation(initial);
  const sidebar = registerSidebarControls({ pinned: true, expanded: true, toggle });
  cleanups.push(navigation.unregister, sidebar.unregister);
  return { back, forward, toggle, initial, navigation, sidebar };
}

describe("Windows navigation-first D titlebar", () => {
  it("shows the app name and icon as decoration only", async () => {
    render(<DesktopTitlebar />);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("desktop_shell", { action: "ready" }));
    const name = screen.getByText("Orbyn Planner").closest(".desktop-app-name");
    expect(name).toHaveAttribute("aria-hidden", "true");
    expect(name?.querySelector("svg")).not.toBeNull();
  });

  it("keeps captions usable through auth while app navigation is unavailable", async () => {
    render(<DesktopTitlebar />);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("desktop_shell", { action: "ready" }));
    const header = screen.getByRole("banner", { name: "Window" });
    expect(within(header).queryByRole("button", { name: "Search or add" })).toBeNull();
    for (const name of ["Toggle sidebar", "Back", "Forward"]) expect(within(header).getByRole("button", { name })).toBeDisabled();
    expect(within(header).getByRole("button", { name: "App menu" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Minimize window" }));
    expect(invoke).toHaveBeenCalledWith("desktop_shell", { action: "minimize" });
    await userEvent.click(screen.getByRole("button", { name: "Maximize window" }));
    await userEvent.click(await screen.findByRole("button", { name: "Restore window" }));
    expect(await screen.findByRole("button", { name: "Maximize window" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Close window" }));
    expect(invoke).toHaveBeenCalledWith("desktop_shell", { action: "close" });
  });

  it("uses the shared sidebar action, real navigation availability and current destination", async () => {
    const app = registerApp();
    render(<DesktopTitlebar />);
    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Forward" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(app.back).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }));
    expect(app.toggle).toHaveBeenCalledOnce();
    act(() => {
      app.navigation.update({ ...app.initial, destination: "Calendar", canGoBack: false, canGoForward: true });
      app.sidebar.update({ pinned: false, expanded: false, toggle: app.toggle });
    });
    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle sidebar" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Forward" }));
    expect(app.forward).toHaveBeenCalledOnce();
    act(() => app.navigation.unregister());
    expect(screen.queryByText("Calendar")).toBeNull();
    expect(screen.getByRole("button", { name: "Toggle sidebar" })).toBeDisabled();
  });

  it("anchors the native menu below the right trigger and restores focus after dismissal", async () => {
    let finishMenu: (value: boolean) => void = () => undefined;
    invoke.mockImplementation((_command: string, args: { action: string }) => args.action === "menu"
      ? new Promise<boolean>((resolve) => { finishMenu = resolve; }) : Promise.resolve(false));
    render(<DesktopTitlebar />);
    const menu = screen.getByRole("button", { name: "App menu" });
    vi.spyOn(menu, "getBoundingClientRect").mockReturnValue({ left: 640, bottom: 35 } as DOMRect);
    vi.spyOn(screen.getByRole("banner", { name: "Window" }), "getBoundingClientRect").mockReturnValue({ bottom: 42 } as DOMRect);
    await userEvent.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    expect(invoke).toHaveBeenCalledWith("desktop_shell", { action: "menu", x: 640, y: 42 });
    await act(async () => finishMenu(false));
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(menu).toHaveFocus();
  });

  it("blocks app navigation and sidebar actions behind a modal but preserves native controls", async () => {
    const app = registerApp();
    function Example() {
      const [open, setOpen] = useState(true);
      return <><div id="root">Planner content</div><DesktopTitlebar />
        {open && <Modal label="Existing dialog" onClose={() => setOpen(false)}>
          <input aria-label="Task title" /><button onClick={() => setOpen(false)}>Done</button>
        </Modal>}</>;
    }
    render(<Example />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Back" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "Toggle sidebar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Minimize window" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "App menu" })).toBeEnabled();
    runShellNavigation("back");
    expect(app.back).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }));
    expect(app.toggle).not.toHaveBeenCalled();
    const editor = screen.getByRole("textbox", { name: "Task title" });
    await userEvent.click(editor);
    await userEvent.click(screen.getByRole("button", { name: "App menu" }));
    await waitFor(() => expect(editor).toHaveFocus());
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Back" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(app.back).toHaveBeenCalledOnce();
  });

  it("drags only empty header space and double-clicks it to maximize", async () => {
    render(<DesktopTitlebar />);
    const header = screen.getByRole("banner", { name: "Window" });
    invoke.mockClear();
    fireEvent.mouseDown(screen.getByText("Workspace"), { button: 0, detail: 1 });
    fireEvent.mouseDown(header, { button: 2, detail: 1 });
    expect(invoke).not.toHaveBeenCalled();
    fireEvent.mouseDown(header, { button: 0, detail: 1 });
    expect(invoke).toHaveBeenCalledWith("desktop_shell", { action: "drag" });
    fireEvent.mouseDown(header, { button: 0, detail: 2 });
    expect(invoke).toHaveBeenCalledWith("desktop_shell", { action: "toggle_maximize" });
    await screen.findByRole("button", { name: "Restore window" });
  });

  it("restores the native frame if readiness or a later control fails", async () => {
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
