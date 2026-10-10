/** Root redirect target based on auth state (used by app/index.tsx). */
export function resolveAuthEntryPath(signedIn: boolean): "/sign-in" | "/home" {
  return signedIn ? "/home" : "/sign-in"
}
