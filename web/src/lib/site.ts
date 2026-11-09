/** The Orbyn site: where pages the planner points to live. `VITE_ORBYN_SITE_URL` sets it, like the engine's address. */
export function siteUrl(): string {
  return (import.meta.env.VITE_ORBYN_SITE_URL ?? "https://orbyn.dev").replace(/\/+$/, "");
}

/** The page that says what can be downloaded (today it reads "Nothing to download yet"). */
export const downloadUrl = (): string => `${siteUrl()}/download`;

/** The launch switch: off until the Orbyn apps can be downloaded. `VITE_ORBYN_APPS_AVAILABLE=true` turns it on. */
export const appsAvailable = (): boolean => import.meta.env.VITE_ORBYN_APPS_AVAILABLE === "true";

/** The planner page on orbyn.dev that "See how it works" on the landing page opens (in this tab). The one place this address is written. */
export const PLANNER_PAGE_URL = "https://orbyn.dev/planner";
