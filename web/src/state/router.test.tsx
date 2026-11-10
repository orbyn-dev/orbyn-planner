import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouterProvider, useRouter } from "./router";

function Navigation() {
  const router = useRouter();
  return <><output aria-label="Current path">{router.path}</output>
    <button onClick={() => router.navigate("/tasks")}>Tasks</button>
    <button onClick={() => router.navigate("/calendar")}>Calendar</button>
    <button onClick={() => router.navigate("/projects")}>Projects</button>
    <button disabled={!router.canGoBack} onClick={router.back}>Back</button>
    <button disabled={!router.canGoForward} onClick={router.forward}>Forward</button>
    <button disabled={!router.canGoBack} onClick={() => { router.back(); router.back(); }}>Back twice</button>
  </>;
}
const mount = () => render(<RouterProvider><Navigation /></RouterProvider>);
const pathIs = (path: string) => waitFor(() => expect(screen.getByRole("status", { name: "Current path" })).toHaveTextContent(path));
beforeEach(() => { window.history.replaceState(null, "", "/today"); });
afterEach(() => { vi.restoreAllMocks(); });

describe("owned in-app navigation history", () => {
  it("traverses real entries and trims forward history after a new destination", async () => {
    mount();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Forward" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Tasks" }));
    await userEvent.click(screen.getByRole("button", { name: "Calendar" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await pathIs("/tasks");
    await userEvent.click(screen.getByRole("button", { name: "Forward" }));
    await pathIs("/calendar");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await pathIs("/tasks");
    await userEvent.click(screen.getByRole("button", { name: "Projects" }));
    expect(window.location.pathname).toBe("/projects");
    expect(screen.getByRole("button", { name: "Forward" })).toBeDisabled();
  });

  it("preserves existing object state when marking the initial app entry", async () => {
    window.history.replaceState({ consumer: { value: 7 } }, "", "/today");
    mount();
    expect(window.history.state.consumer).toEqual({ value: 7 });
    await userEvent.click(screen.getByRole("button", { name: "Tasks" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await pathIs("/today");
    expect(window.history.state.consumer).toEqual({ value: 7 });
  });

  it("does not overwrite primitive history state or traverse into an unowned entry", async () => {
    window.history.replaceState("external-state", "", "/today");
    mount();
    expect(window.history.state).toBe("external-state");
    await userEvent.click(screen.getByRole("button", { name: "Tasks" }));
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Calendar" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await pathIs("/tasks");
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  });

  it("guards repeated traversal synchronously until popstate resolves", async () => {
    mount();
    await userEvent.click(screen.getByRole("button", { name: "Tasks" }));
    const back = vi.spyOn(window.history, "go").mockImplementation(() => undefined);
    await userEvent.click(screen.getByRole("button", { name: "Back twice" }));
    expect(back).toHaveBeenCalledOnce();
    expect(back).toHaveBeenCalledWith(-1);
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Forward" })).toBeDisabled();
  });

  it("resets the traversable boundary after an unknown or replaced history entry", async () => {
    mount();
    await userEvent.click(screen.getByRole("button", { name: "Tasks" }));
    act(() => {
      window.history.pushState({ otherOwner: true }, "", "/lists");
      window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
    });
    await pathIs("/lists");
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Forward" })).toBeDisabled();
    expect(window.history.state.otherOwner).toBe(true);
  });

  it("does not create another entry for the current destination", async () => {
    mount();
    await userEvent.click(screen.getByRole("button", { name: "Tasks" }));
    const push = vi.spyOn(window.history, "pushState");
    await userEvent.click(screen.getByRole("button", { name: "Tasks" }));
    expect(push).not.toHaveBeenCalled();
  });
});
