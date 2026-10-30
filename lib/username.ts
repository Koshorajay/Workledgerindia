export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}
export function loginAddress(value: string) {
  const username = normalizeUsername(value);
  if (!/^[a-z][a-z0-9_]{1,31}$/.test(username)) {
    throw new Error(
      "Use 2–32 letters, numbers or underscores, starting with a letter.",
    );
  }
  // Internal Auth identifier only. No email is sent to this reserved domain.
  return `${username}@workledger.invalid`;
}
