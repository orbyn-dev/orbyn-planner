/** Reminder choices for a task: minutes before the due time, 0 being at the due time. */
export const TASK_REMINDERS: readonly { value: number | null; label: string }[] = [
  { value: null, label: "None" },
  { value: 0, label: "At the due time" },
  { value: 5, label: "5 minutes before" },
  { value: 15, label: "15 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 1440, label: "1 day before" },
];

export function taskReminderLabel(minutes: number | null): string {
  return TASK_REMINDERS.find((r) => r.value === minutes)?.label ?? `${minutes} minutes before`;
}

/** The reminder popover's choices (Planner Designs p-row-reminder): the same words for tasks and events. Custom… is a field, not a value. */
export const REMINDER_MENU: readonly { value: number | null; label: string }[] = [
  { value: null, label: "None" },
  { value: 0, label: "At time" },
  { value: 5, label: "5 minutes before" },
  { value: 15, label: "15 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 1440, label: "1 day before" },
];

/** "None", "At time", "45 minutes before", "2 hours before", "3 days before". */
export function reminderLabel(minutes: number | null): string {
  const known = REMINDER_MENU.find((r) => r.value === minutes);
  if (known) return known.label;
  const m = minutes ?? 0;
  const [n, unit] = m % 1440 === 0 ? [m / 1440, "day"] : m % 60 === 0 ? [m / 60, "hour"] : [m, "minute"];
  return `${n} ${unit}${n === 1 ? "" : "s"} before`;
}
