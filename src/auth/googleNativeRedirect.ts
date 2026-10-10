const GOOGLE_CLIENT_SUFFIX = ".apps.googleusercontent.com"

/**
 * Reverse-DNS URL scheme Google assigns to a native OAuth client.
 * Only iOS needs it (Info.plist via the google-signin config plugin);
 * Android authenticates by package name + SHA-1.
 */
export function googleNativeUrlScheme(clientId: string): string | null {
  const trimmed = clientId.trim()
  if (!trimmed.endsWith(GOOGLE_CLIENT_SUFFIX)) return null
  const prefix = trimmed.slice(0, -GOOGLE_CLIENT_SUFFIX.length).trim()
  if (!prefix) return null
  return `com.googleusercontent.apps.${prefix}`
}
