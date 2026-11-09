/** The engine's address. `VITE_ENGINE_URL` sets it; local development falls back to the local engine. */
export function engineUrl(): string {
  return import.meta.env.VITE_ENGINE_URL ?? "http://localhost:8080";
}

/** The engine's address when one is configured for this build (VITE_ENGINE_URL), otherwise null. */
export function configuredEngine(): string | null {
  const url = import.meta.env.VITE_ENGINE_URL;
  return typeof url === "string" && url.trim() !== "" ? url.replace(/\/+$/, "") : null;
}

/** The desktop app's page may not fetch other sites (its security policy forbids it), so it needs the engine for feeds. */
export function inDesktopApp(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export const NEEDS_ENGINE = "Subscriptions need the Orbyn engine";
export const NEEDS_SIGN_IN = "Sign in to subscribe to calendars";
