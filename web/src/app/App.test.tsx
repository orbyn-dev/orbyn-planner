import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { initialsOf } from "../lib/initials";

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
});

describe("navigation", () => {
  it("shows the Today empty state first", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Nothing planned today" })).toBeInTheDocument(); // after the store has loaded
    expect(screen.getByRole("button", { name: "New task" })).toBeEnabled();
    expect(screen.getByText("Done today")).toBeInTheDocument();
  });

  it("changes page and URL from the sidebar and follows history", async () => {
    render(<App />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    await userEvent.click(within(nav).getByRole("link", { name: "Calendar" }));
    expect(window.location.pathname).toBe("/calendar");
    expect(screen.getByRole("radio", { name: "Week", checked: true })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Calendar" })).toHaveAttribute("aria-current", "page");

    window.history.pushState(null, "", "/lists");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(await screen.findByRole("navigation", { name: "Your lists" })).toBeInTheDocument();
  });

  it("keeps every primary destination, Settings included, in one navigation", () => {
    render(<App />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getAllByRole("link").map((l) => l.textContent)).toEqual([
      "Today", "Tasks", "Calendar", "Lists", "Projects", "Notifications", "Settings",
    ]);
  });

  it("starts with a skip link that moves focus to the content", async () => {
    render(<App />);
    await userEvent.tab();
    const skip = screen.getByRole("link", { name: "Skip to content" });
    expect(skip).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("main")).toHaveFocus();
  });
});

describe("phone tab bar and menu", () => {
  it("has no More tab: Today, Tasks, Calendar, Lists and Search", () => {
    render(<App />);
    const tabs = screen.getByRole("navigation", { name: "Tabs" });
    expect(within(tabs).getAllByRole("link").map((l) => l.textContent)).toEqual(["Today", "Tasks", "Calendar", "Lists"]);
    expect(within(tabs).getByRole("button", { name: "Search" })).toBeInTheDocument();
    expect(within(tabs).queryByRole("button", { name: "More" })).toBeNull();
  });

  it("reaches Notifications, Projects and Settings from the round button in the Today header", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("max-width"), media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
    try {
      render(<App />);
      const button = await screen.findByRole("button", { name: "Menu" });
      expect(button).toHaveTextContent("SA");
      await userEvent.click(button);
      const sheet = screen.getByRole("dialog", { name: "Menu" });
      expect(within(sheet).getAllByRole("link").map((l) => l.textContent)).toEqual(["Notifications", "Projects", "Settings"]);
      await userEvent.click(within(sheet).getByRole("link", { name: "Settings" }));
      expect(window.location.pathname).toBe("/settings");
      expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("closes with Escape and returns focus to the round button", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("max-width"), media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
    try {
      window.history.replaceState(null, "", "/today");
      render(<App />);
      const button = await screen.findByRole("button", { name: "Menu" });
      await userEvent.click(button);
      await userEvent.keyboard("{Escape}");
      expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument();
      expect(button).toHaveFocus();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("initialsOf", () => {
  it("takes first and last initial, the first two letters of one word, then the email, then SA", () => {
    expect(initialsOf("Sam Arden", undefined)).toBe("SA");
    expect(initialsOf("Sam van Arden", undefined)).toBe("SA");
    expect(initialsOf("sam", undefined)).toBe("SA");
    expect(initialsOf("", "jo@example.com")).toBe("JO");
    expect(initialsOf(undefined, undefined)).toBe("SA");
  });
});
