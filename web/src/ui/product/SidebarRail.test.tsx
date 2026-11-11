import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SidebarRail } from "./SidebarRail";
import { clampSidebar, SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN } from "./sidebarWidth";

describe("the sidebar resize rail (as in Engineering)", () => {
  it("keeps the width between 180 and 420 and starts at 224", () => {
    expect([SIDEBAR_MIN, SIDEBAR_MAX, SIDEBAR_DEFAULT]).toEqual([180, 420, 224]);
    expect(clampSidebar(100)).toBe(180);
    expect(clampSidebar(900)).toBe(420);
    expect(clampSidebar(300.4)).toBe(300);
  });

  it("is a vertical separator with its value and limits", () => {
    render(<SidebarRail width={260} onChange={() => {}} />);
    const rail = screen.getByRole("separator", { name: "Resize sidebar" });
    expect(rail.getAttribute("aria-valuenow")).toBe("260");
    expect(rail.getAttribute("aria-valuemin")).toBe("180");
    expect(rail.getAttribute("aria-valuemax")).toBe("420");
  });

  it("Left and Right move it 16 px, kept inside the limits", () => {
    const onChange = vi.fn();
    render(<SidebarRail width={224} onChange={onChange} />);
    const rail = screen.getByRole("separator");
    fireEvent.keyDown(rail, { key: "ArrowRight" });
    fireEvent.keyDown(rail, { key: "ArrowLeft" });
    expect(onChange.mock.calls).toEqual([[240], [208]]);
  });

  it("a double click puts it back to the default", () => {
    const onChange = vi.fn();
    render(<SidebarRail width={400} onChange={onChange} />);
    fireEvent.doubleClick(screen.getByRole("separator"));
    expect(onChange).toHaveBeenCalledWith(224);
  });

  it("shows the width while dragging, and the limit it stopped at", () => {
    render(<div className="app"><SidebarRail width={224} onChange={() => {}} /></div>);
    const rail = screen.getByRole("separator");
    rail.setPointerCapture = () => {};
    act(() => { fireEvent.pointerDown(rail, { pointerId: 1 }); });
    expect(screen.queryByText("224")).not.toBeNull();
    act(() => { fireEvent.pointerMove(rail, { clientX: 272 }); });
    expect(screen.queryByText("272")).not.toBeNull();
    act(() => { fireEvent.pointerMove(rail, { clientX: 50 }); });
    expect(screen.queryByText("180 · minimum")).not.toBeNull();
    act(() => { fireEvent.pointerMove(rail, { clientX: 900 }); });
    expect(screen.queryByText("420 · maximum")).not.toBeNull();
  });
});
