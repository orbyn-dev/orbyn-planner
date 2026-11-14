import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "./App";
import { DesktopTitlebar } from "./DesktopTitlebar";
import { getShellNavigation } from "./desktopShell";
import { getSidebarSnapshot } from "./sidebarControls";

beforeEach(() => {
  window.history.replaceState(null, "", "/today");
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
  vi.stubGlobal("matchMedia", (media: string) => ({ matches: false, media, addEventListener: () => undefined, removeEventListener: () => undefined }));
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = { invoke: vi.fn().mockResolvedValue(false) };
  document.documentElement.setAttribute("data-titlebar", "windows");
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-titlebar");
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

it("connects D to the actual sidebar, route history and workspace lifecycle", async () => {
  function Preview() {
    const [mounted, setMounted] = useState(true);
    return <><DesktopTitlebar /><div id="root">{mounted && <App />}</div>
      <button onClick={() => setMounted(false)}>Leave workspace</button></>;
  }
  render(<Preview />);
  const header = within(screen.getByRole("banner", { name: "Window" }));
  const toggle = header.getByRole("button", { name: "Toggle sidebar" });
  // The title bar's toggle is the only one: the sidebar shows none of its own.
  expect(screen.queryByRole("button", { name: /Collapse sidebar|Pin sidebar open/ })).toBeNull();
  expect(toggle).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(toggle);
  const aside = screen.getByRole("complementary");
  expect(aside).toHaveAttribute("data-pinned", "false");
  expect(toggle).toHaveAttribute("aria-pressed", "false");
  const primary = within(screen.getByRole("navigation", { name: "Primary" }));
  await userEvent.click(primary.getByRole("link", { name: "Projects" }));
  expect(header.getByText("Projects")).toBeInTheDocument();
  await userEvent.click(header.getByRole("button", { name: "Back" }));
  await waitFor(() => expect(window.location.pathname).toBe("/today"));
  expect(header.getByText("Today")).toBeInTheDocument();
  await userEvent.click(header.getByRole("button", { name: "Forward" }));
  await waitFor(() => expect(window.location.pathname).toBe("/projects"));
  act(() => screen.getByRole("main").focus());
  fireEvent.pointerLeave(aside);
  fireEvent.pointerEnter(aside, { pointerType: "mouse" });
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(toggle).toHaveAttribute("aria-pressed", "false");
  await userEvent.click(toggle);
  expect(aside).toHaveAttribute("data-pinned", "true");
  expect(toggle).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(screen.getByRole("button", { name: "Leave workspace" }));
  expect(getShellNavigation()).toBeNull();
  expect(getSidebarSnapshot()).toBeNull();
  expect(toggle).toBeDisabled();
  expect(header.getByRole("button", { name: "Back" })).toBeDisabled();
  expect(header.queryByText("Projects")).toBeNull();
});
