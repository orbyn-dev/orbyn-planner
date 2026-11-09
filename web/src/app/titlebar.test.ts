import { describe, expect, it } from "vitest";
import { applyTitlebar, isMacShell } from "./titlebar";

describe("the macOS title bar strip", () => {
  it("marks the page and adds one drag strip in the macOS shell", () => {
    const doc = document.implementation.createHTMLDocument("t");
    applyTitlebar(doc, true);
    applyTitlebar(doc, true);
    expect(doc.documentElement.getAttribute("data-titlebar")).toBe("overlay");
    const strips = doc.querySelectorAll(".titlebar");
    expect(strips).toHaveLength(1);
    expect(strips[0]!.hasAttribute("data-tauri-drag-region")).toBe(true);
    expect(strips[0]!.getAttribute("aria-hidden")).toBe("true");
  });

  it("does nothing outside the macOS shell", () => {
    const doc = document.implementation.createHTMLDocument("t");
    applyTitlebar(doc, false);
    expect(doc.documentElement.hasAttribute("data-titlebar")).toBe(false);
    expect(doc.querySelector(".titlebar")).toBeNull();
  });

  it("is the macOS shell only inside Tauri on a Mac", () => {
    expect(isMacShell({ platform: "MacIntel" })).toBe(false); // a browser on a Mac is not the shell
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    try {
      expect(isMacShell({ platform: "MacIntel" })).toBe(true);
      expect(isMacShell({ platform: "Win32", userAgent: "Windows" })).toBe(false);
    } finally {
      delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    }
  });
});
