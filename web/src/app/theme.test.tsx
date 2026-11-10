import { act, render, screen, within } from "@testing-library/react";
import { firstRunDoneForTests } from "../test-setup";
import userEvent from "@testing-library/user-event";
import html from "../../index.html?raw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrefsProvider } from "../state/prefs";
import { SettingsPage } from "../features/settings";
import { applyChoice, chooseTheme, DARK_KEY, readDarkTheme, readStoredChoice, THEME_KEY, watchSystemTheme } from "../ui/theme";

function stubSystem(dark: boolean) {
  let listener: (() => void) | undefined;
  const query = {
    get matches() {
      return dark;
    },
    addEventListener: (_: string, l: () => void) => (listener = l),
    removeEventListener: () => (listener = undefined),
  };
  vi.stubGlobal("matchMedia", () => query);
  return {
    flip() {
      dark = !dark;
      listener?.();
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("theme", () => {
  it("persists the choice and sets data-theme: Theme says Dark, Dark theme says which (Planner Designs settings)", async () => {
    stubSystem(false);
    render(<PrefsProvider><SettingsPage /></PrefsProvider>);
    // The rows show their value; a click opens the choices (Planner Designs settings).
    const open = (name: string, menu: string) =>
      userEvent.click(screen.getByRole("button", { name })).then(() => within(screen.getByRole("menu", { name: menu })));
    const dark = await open("Dark theme, Dark · Dim", "Dark theme");
    expect(dark.getAllByRole("menuitemradio").map((r) => r.textContent)).toEqual(["Dark", "Dim"]);
    await userEvent.click(dark.getByRole("menuitemradio", { name: "Dim" })); // System on a light system: stays light, remembers Dim
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(DARK_KEY)).toBe("dim");
    const theme = await open("Theme, System", "Theme");
    await userEvent.click(theme.getByRole("menuitemradio", { name: "Dark" })); // Dark is the chosen dark theme: Dim
    expect(document.documentElement.dataset.theme).toBe("dim");
    expect(localStorage.getItem(THEME_KEY)).toBe("dim");
    expect(screen.getByRole("button", { name: "Theme, Dark" })).toBeTruthy();
    const again = await open("Dark theme, Dark · Dim", "Dark theme");
    await userEvent.click(again.getByRole("menuitemradio", { name: "Dark" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("button", { name: "Theme, Dark" })).toBeTruthy();
  });

  it("System on a dark system uses the chosen dark theme, and a Dim chosen before this setting counts as Dim", () => {
    stubSystem(true);
    localStorage.setItem(DARK_KEY, "dim");
    applyChoice("system");
    expect(document.documentElement.dataset.theme).toBe("dim");
    localStorage.clear();
    firstRunDoneForTests();
    localStorage.setItem(THEME_KEY, "dim");
    expect(readDarkTheme()).toBe("dim");
  });

  it("defaults to the system and ignores junk in storage", () => {
    stubSystem(true);
    expect(readStoredChoice()).toBe("system");
    localStorage.setItem(THEME_KEY, "neon");
    expect(readStoredChoice()).toBe("system");
    applyChoice(readStoredChoice());
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("System follows the operating system while it is chosen", async () => {
    const system = stubSystem(false);
    const stop = watchSystemTheme();
    chooseTheme("system");
    expect(document.documentElement.dataset.theme).toBe("light");
    act(() => system.flip());
    expect(document.documentElement.dataset.theme).toBe("dark");
    chooseTheme("dim");
    act(() => system.flip());
    expect(document.documentElement.dataset.theme).toBe("dim");
    stop();
  });

  it("offers System, Light and Dark, with System chosen", async () => {
    stubSystem(false);
    render(<PrefsProvider><SettingsPage /></PrefsProvider>);
    await userEvent.click(screen.getByRole("button", { name: "Theme, System" }));
    const theme = within(screen.getByRole("menu", { name: "Theme" }));
    expect(theme.getAllByRole("menuitemradio").map((r) => r.textContent)).toEqual(["System", "Light", "Dark"]);
    expect(theme.getByRole("menuitemradio", { name: "System" }).getAttribute("aria-checked")).toBe("true");
  });
});

describe("theme before first paint", () => {
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1]!;

  it("does not hard-code a theme in the page", () => {
    expect(html).not.toMatch(/<html[^>]*data-theme/);
  });

  it("sets data-theme from storage, else from the system", () => {
    stubSystem(true);
    localStorage.setItem(THEME_KEY, "dim");
    new Function(script)();
    expect(document.documentElement.dataset.theme).toBe("dim");
    localStorage.setItem(THEME_KEY, "system");
    new Function(script)();
    expect(document.documentElement.dataset.theme).toBe("dark");
    localStorage.clear();
  firstRunDoneForTests();
    stubSystem(false);
    new Function(script)();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("uses the chosen dark theme when the system is dark and nothing else is chosen", () => {
    stubSystem(true);
    localStorage.setItem(DARK_KEY, "dim");
    new Function(script)();
    expect(document.documentElement.dataset.theme).toBe("dim");
    localStorage.clear();
  });

  it("survives blocked storage", () => {
    stubSystem(true);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    new Function(script)();
    expect(document.documentElement.dataset.theme).toBe("dark");
    vi.restoreAllMocks();
  });
});
