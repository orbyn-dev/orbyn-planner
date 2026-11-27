import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { LocalStore } from "../../data/local/LocalStore";
import { MemoryPersistence } from "../../data/local/persistence";
import { consumeSettingsTarget, peekSettingsTarget, setSettingsTarget, takeSettingsTarget } from "../../state/settingsTarget";

it("opens the requested settings category when React retries a StrictMode mount", async () => {
  window.history.replaceState(null, "", "/settings");
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
  const store = new LocalStore({ persistence: new MemoryPersistence(), broadcast: false });
  await store.ready;
  setSettingsTarget("Account");
  render(<StrictMode><App store={store} /></StrictMode>);
  expect(await screen.findByRole("heading", { name: "Account", level: 2 })).toBeInTheDocument();
});

it("does not consume a newer request for the same category", () => {
  setSettingsTarget("Account");
  const earlier = peekSettingsTarget();
  setSettingsTarget("Account");
  consumeSettingsTarget(earlier);
  expect(takeSettingsTarget()).toBe("Account");
});
