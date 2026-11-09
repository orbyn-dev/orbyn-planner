import type { IconName } from "../ui/primitives/icons";

export interface NavItem {
  path: string;
  label: string;
  icon: IconName;
}

export const NAV: readonly NavItem[] = [
  { path: "/today", label: "Today", icon: "home" },
  { path: "/tasks", label: "Tasks", icon: "check" },
  { path: "/calendar", label: "Calendar", icon: "cal" },
  { path: "/lists", label: "Lists", icon: "list" },
  { path: "/projects", label: "Projects", icon: "folder" },
  { path: "/notifications", label: "Notifications", icon: "bell" },
];

export const SETTINGS: NavItem = { path: "/settings", label: "Settings", icon: "gear" };

/**
 * Reached from the round button at the right of the phone's Today header (Planner Designs p-phone-menu), which has no More tab to
 * hold them. Booking is drawn too, and is added when Booking is built.
 */
export const PHONE_MENU: readonly NavItem[] = [NAV[5]!, NAV[4]!, SETTINGS];

/** The phone tab bar: four daily pages and search. */
export const TABS: readonly NavItem[] = [
  ...NAV.slice(0, 4),
  { path: "/search", label: "Search", icon: "search" },
];
