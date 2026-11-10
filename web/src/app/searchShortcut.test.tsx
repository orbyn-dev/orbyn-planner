import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

beforeEach(() => {
  window.history.replaceState(null, "", "/today");
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("platform-specific sidebar search hints", () => {
  it.each([
    ["Win32", "Windows NT 10.0", "Ctrl+K"],
    ["MacIntel", "Mac OS X", "⌘K"],
  ])("shows the search shortcut for %s", (platform, userAgent, hint) => {
    vi.spyOn(window.navigator, "platform", "get").mockReturnValue(platform);
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(userAgent);
    render(<App />);
    expect(screen.getByRole("button", { name: "Search or add" })).toHaveTextContent(hint);
  });
});
