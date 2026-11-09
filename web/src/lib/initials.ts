/** Initials for the round menu button: the account's, or SA as the designs draw it when no one is signed in. */
export function initialsOf(name: string | undefined, email: string | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase();
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  const local = (email ?? "").split("@")[0] ?? "";
  return local ? local.slice(0, 2).toUpperCase() : "SA";
}

