import { useSyncExternalStore } from "react";

/**
 * Whether this device was just signed out by "Sign out everywhere" (Planner Designs v73 p-signout-everywhere-done): the signed-out Account
 * page then says what happened. Kept in memory for this visit only; signing in again or dismissing it clears it.
 */
let signedOut = false;
const listeners = new Set<() => void>();

export const signedOutEverywhere = {
  get: () => signedOut,
  set(value: boolean) {
    if (value === signedOut) return;
    signedOut = value;
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
};

export function useSignedOutEverywhere(): boolean {
  return useSyncExternalStore(signedOutEverywhere.subscribe, signedOutEverywhere.get);
}
