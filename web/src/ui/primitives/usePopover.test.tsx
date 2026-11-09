import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { usePopover } from "./usePopover";

function Demo() {
  const [open, setOpen] = useState(true);
  const anchor = useRef<HTMLButtonElement>(null);
  const pop = usePopover(open, () => setOpen(false), anchor);
  return (
    <>
      <button ref={anchor} onClick={() => setOpen(!open)}>Anchor</button>
      <p>outside</p>
      {open && <div ref={pop} role="dialog"><input aria-label="field" /></div>}
    </>
  );
}

describe("usePopover", () => {
  it("Escape closes and returns focus to the anchor", async () => {
    render(<Demo />);
    await userEvent.click(screen.getByLabelText("field"));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Anchor" })).toHaveFocus();
  });

  it("a click outside closes; a click inside does not", async () => {
    render(<Demo />);
    await userEvent.click(screen.getByLabelText("field"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByText("outside"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
