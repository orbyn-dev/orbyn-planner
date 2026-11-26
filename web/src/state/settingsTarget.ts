/** Where Settings opens next: a screen that sends the person to a category says so here. */
let target: string | null = null;
let revision = 0;
export const setSettingsTarget = (category: string) => { target = category; revision++; };
export function takeSettingsTarget(): string | null {
  const value = target;
  target = null;
  revision++;
  return value;
}

/** A render can be interrupted; only its later commit may consume the observed request. */
export const peekSettingsTarget = () => ({ category: target, revision });
export function consumeSettingsTarget(expected: ReturnType<typeof peekSettingsTarget>): void {
  if (revision === expected.revision) { target = null; revision++; }
}
