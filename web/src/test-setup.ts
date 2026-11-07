import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach } from "vitest";

// The direct `userEvent.click(...)` calls wait a macrotask between every pointer and key step. Under a busy machine those waits are
// what makes a UI test slow and timing-dependent, and nothing here depends on them, so the direct calls run without the delay.
beforeEach(() => {
  if (typeof document === "undefined") return;
  // Most tests are about a planner already in use: first run is done for the local-only planner unless a test says otherwise (it
  // removes the key), and a test that clears storage keeps it.
  if (typeof localStorage !== "undefined") {
    const clear = Storage.prototype.clear;
    Storage.prototype.clear = function (this: Storage) {
      clear.call(this);
      if (this === localStorage) this.setItem("orbyn-planner.first-run.local", "done");
    };
    localStorage.setItem("orbyn-planner.first-run.local", "done");
  }
  const instant = userEvent.setup({ delay: null });
  for (const name of Object.keys(instant) as (keyof typeof instant)[]) {
    if (name !== "setup") (userEvent as unknown as Record<string, unknown>)[name] = instant[name];
  }
});

afterEach(() => {
  cleanup();
  if (typeof localStorage !== "undefined") localStorage.clear();
  if (typeof document !== "undefined") document.documentElement.removeAttribute("data-theme");
});
