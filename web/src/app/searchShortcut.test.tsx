import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

afterEach(() => vi.restoreAllMocks());

describe("the search shortcut hint", () => {
  for (const [platform, hint, modifier] of [
    ["Win32", "Ctrl+K", "Control"],
    ["Linux x86_64", "Ctrl+K", "Control"],
    ["MacIntel", "⌘K", "Meta"],
  ] as const) {
    it(`shows ${hint} on ${platform} and opens search with that shortcut`, async () => {
      vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);
      render(<App />);
      const button = screen.getByRole("button", { name: "Search or add" });
      expect(within(button).getByText(hint)).toBeInTheDocument();
      button.focus();
      await userEvent.keyboard(`{${modifier}>}k{/${modifier}}`);
      expect(screen.getByRole("dialog", { name: "Search or add" })).toBeInTheDocument();
      await userEvent.keyboard(`{${modifier}>}k{/${modifier}}`);
      expect(screen.queryByRole("dialog", { name: "Search or add" })).not.toBeInTheDocument();
      expect(button).toHaveFocus();
    });
  }
});
