import { getMobileGoogleAuthConfig, type MobileGoogleAuthConfig } from "@morphos/portal-api-client"
import { googleSignInAvailable, type GoogleSignInClientIds, type GoogleSignInPlatform } from "./googleSignInCore"

export type GoogleSignInConfigState =
  | { status: "loading" }
  | { status: "ready"; ids: GoogleSignInClientIds }
  | { status: "unavailable" }

export function clientIdsFromConfig(config: MobileGoogleAuthConfig): GoogleSignInClientIds {
  return {
    googleWebClientId: config.clientId?.trim() || undefined,
    googleIosClientId: config.iosClientId?.trim() || undefined,
  }
}

/** Portal API values win so a wrong client id can be corrected without an app rebuild. */
export function mergeGoogleSignInIds(
  fallback: GoogleSignInClientIds,
  fetched: GoogleSignInClientIds | null,
): GoogleSignInClientIds {
  return {
    googleWebClientId: fetched?.googleWebClientId?.trim() || fallback.googleWebClientId?.trim() || undefined,
    googleIosClientId: fetched?.googleIosClientId?.trim() || fallback.googleIosClientId?.trim() || undefined,
  }
}

export function resolveGoogleSignInIds(params: {
  platform: GoogleSignInPlatform
  fallback: GoogleSignInClientIds
  fetched: GoogleSignInClientIds | null
}): Exclude<GoogleSignInConfigState, { status: "loading" }> {
  const ids = mergeGoogleSignInIds(params.fallback, params.fetched)
  return googleSignInAvailable(params.platform, ids) ? { status: "ready", ids } : { status: "unavailable" }
}

/** Android DEVELOPER_ERROR means package name / SHA-1 do not match the Google Cloud client. */
export function isGoogleClientConfigError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes("developer_error") ||
    lower.includes("developer error") ||
    lower.includes("audience") ||
    lower.includes("invalid google sign-in token") ||
    lower.includes("sign_in_failed")
  )
}

/** Fills the {platform} slot in localized Google sign-in copy with a user-facing OS name. */
export function interpolatePlatformMessage(template: string, platform: GoogleSignInPlatform): string {
  return template.replace(/\{platform\}/g, platform === "ios" ? "iOS" : "Android")
}

export function friendlyGoogleSignInError(err: unknown, fallback: string, misconfigured: string): string {
  const raw = err instanceof Error ? err.message.trim() : String(err ?? "").trim()
  if (!raw) return fallback
  if (isGoogleClientConfigError(raw)) return misconfigured
  return raw
}

export async function fetchGoogleSignInConfig(
  baseUrl: string,
  platform: GoogleSignInPlatform,
  fallback: GoogleSignInClientIds,
  fetchConfig: typeof getMobileGoogleAuthConfig = getMobileGoogleAuthConfig,
): Promise<Exclude<GoogleSignInConfigState, { status: "loading" }>> {
  let fetched: GoogleSignInClientIds | null = null
  try {
    const cfg = await fetchConfig(baseUrl)
    if (cfg.ok) fetched = clientIdsFromConfig(cfg.data)
  } catch {
    // Network failures fall back to the client ids baked into the build.
  }
  return resolveGoogleSignInIds({ platform, fallback, fetched })
}
