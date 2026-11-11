import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouterProvider, useRouter } from "../../state/router";
import { TitleRow } from "./TitleRow";

function Harness({ hidden = false, onToggle = () => {} }: { hidden?: boolean; onToggle?: () => void }) {
  const { navigate, path } = useRouter();
  return (
    <>
      <TitleRow sideHidden={hidden} onToggle={onToggle} />
      <button onClick={() => navigate("/tasks")}>go tasks</button>
      <button onClick={() => navigate("/calendar")}>go calendar</button>
      <output>{path}</output>
    </>
  );
}

afterEach(() => window.history.replaceState(null, "", "/"));

describe("the window title row", () => {
  it("has the toggle, Back and Forward, with both arrows dimmed on the first screen", () => {
    render(<RouterProvider><Harness /></RouterProvider>);
    expect(screen.getByRole("button", { name: "Hide sidebar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: "Forward" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: "Back" }).className).toContain("dim");
  });

  it("reads Show sidebar when the sidebar is hidden, and the toggle calls back", () => {
    const toggle = vi.fn();
    render(<RouterProvider><Harness hidden onToggle={toggle} /></RouterProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Show sidebar" }));
    expect(toggle).toHaveBeenCalledOnce();
  });

  it("Back and Forward move through the screens opened in this window", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const forward = vi.spyOn(window.history, "forward").mockImplementation(() => {});
    render(<RouterProvider><Harness /></RouterProvider>);
    fireEvent.click(screen.getByText("go tasks"));
    fireEvent.click(screen.getByText("go calendar"));
    expect(screen.getByRole("button", { name: "Back" }).getAttribute("aria-disabled")).toBe("false");
    expect(screen.getByRole("button", { name: "Forward" }).getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(back).toHaveBeenCalledOnce();
    // The browser answers a Back with popstate on the entry before.
    act(() => {
      window.history.replaceState({ i: 1 }, "", "/tasks");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByRole("button", { name: "Forward" }).getAttribute("aria-disabled")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Forward" }));
    expect(forward).toHaveBeenCalledOnce();
    back.mockRestore();
    forward.mockRestore();
  });

  it("a dimmed arrow does nothing", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    render(<RouterProvider><Harness /></RouterProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(back).not.toHaveBeenCalled();
    back.mockRestore();
  });
});
