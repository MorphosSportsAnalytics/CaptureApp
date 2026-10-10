/** Default Portal API origin for device / emulator builds (localhost is not reachable). */
export const DEFAULT_PORTAL_API_URL = "https://api.morphosanalytics.com"
export const DEFAULT_PORTAL_WEB_URL = "https://portal.morphosanalytics.com"

/** Public Entra athlete-portal / Capture client. Not a secret. */
export const DEFAULT_MSAL_CLIENT_ID = "a6023341-d99d-48b1-83a3-c657cf791981"

/** Public Google web OAuth client used by Portal API google-config / Athlete Portal SSO. Not a secret. */
export const DEFAULT_GOOGLE_WEB_CLIENT_ID =
  "79042994996-ccbdj2h3gjsd0rtjci0bgt3tij1l2ha3.apps.googleusercontent.com"

/** iOS Google OAuth client for Capture. Not a secret. */
export const DEFAULT_GOOGLE_IOS_CLIENT_ID =
  "79042994996-m23rnjus94uo1uvqn8pd1dft7iaqenml.apps.googleusercontent.com"

/** Production Portal API application id scope. */
export const DEFAULT_MSAL_PORTAL_API_SCOPE = "api://b8d3dc3c-5589-460e-af7e-30a2e6b46bbb/portal.read"

/** Sentinel until env / merge replaces it with DEFAULT_MSAL_PORTAL_API_SCOPE. */
export const PLACEHOLDER_MSAL_PORTAL_API_SCOPE = "api://morphos-portal-api/portal.read"

export type BuildExtra = {
  portalApiUrl?: string
  portalWebUrl?: string
  msalClientId?: string
  msalTenant?: string
  msalPortalApiScope?: string
  googleWebClientId?: string
  googleIosClientId?: string
}

export type BuildExtraEnv = {
  PORTAL_API_URL?: string
  PORTAL_WEB_URL?: string
  MSAL_CLIENT_ID?: string
  MSAL_TENANT?: string
  MSAL_PORTAL_API_SCOPE?: string
  GOOGLE_WEB_CLIENT_ID?: string
  GOOGLE_IOS_CLIENT_ID?: string
  EXPO_PUBLIC_PORTAL_API_URL?: string
  EXPO_PUBLIC_PORTAL_WEB_URL?: string
  EXPO_PUBLIC_MSAL_CLIENT_ID?: string
  EXPO_PUBLIC_MSAL_TENANT?: string
  EXPO_PUBLIC_MSAL_PORTAL_API_SCOPE?: string
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?: string
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?: string
  [key: string]: string | undefined
}

export function isLoopbackPortalUrl(url: string | undefined): boolean {
  const value = url?.trim() ?? ""
  return value.includes("localhost") || value.includes("127.0.0.1")
}

function firstEnv(env: BuildExtraEnv, keys: string[]): string {
  for (const key of keys) {
    const value = env[key]?.trim()
    if (value) return value
  }
  return ""
}

/** Merge bundled defaults with CI / local env overrides (phones cannot use localhost). */
export function mergeBuildExtra(base: BuildExtra, env: BuildExtraEnv): BuildExtra {
  const fromEnv = firstEnv(env, ["PORTAL_API_URL", "EXPO_PUBLIC_PORTAL_API_URL"])
  const fromBase = base.portalApiUrl?.trim()
  const portalApiUrl = (
    fromEnv ||
    (fromBase && !isLoopbackPortalUrl(fromBase) ? fromBase : "") ||
    DEFAULT_PORTAL_API_URL
  ).replace(/\/$/, "")

  const portalWebUrl = (
    firstEnv(env, ["PORTAL_WEB_URL", "EXPO_PUBLIC_PORTAL_WEB_URL"]) ||
    base.portalWebUrl?.trim() ||
    DEFAULT_PORTAL_WEB_URL
  ).replace(/\/$/, "")

  const msalClientId = (
    firstEnv(env, ["MSAL_CLIENT_ID", "EXPO_PUBLIC_MSAL_CLIENT_ID"]) ||
    base.msalClientId?.trim() ||
    DEFAULT_MSAL_CLIENT_ID
  ).trim()
  const msalTenant = (
    firstEnv(env, ["MSAL_TENANT", "EXPO_PUBLIC_MSAL_TENANT"]) ||
    base.msalTenant?.trim() ||
    "common"
  ).trim()
  const rawScope = (
    firstEnv(env, ["MSAL_PORTAL_API_SCOPE", "EXPO_PUBLIC_MSAL_PORTAL_API_SCOPE"]) ||
    base.msalPortalApiScope?.trim() ||
    DEFAULT_MSAL_PORTAL_API_SCOPE
  ).trim()
  const msalPortalApiScope =
    !rawScope || rawScope === PLACEHOLDER_MSAL_PORTAL_API_SCOPE ? DEFAULT_MSAL_PORTAL_API_SCOPE : rawScope

  const googleWebClientId = (
    firstEnv(env, ["GOOGLE_WEB_CLIENT_ID", "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"]) ||
    base.googleWebClientId?.trim() ||
    DEFAULT_GOOGLE_WEB_CLIENT_ID
  ).trim()

  const googleIosClientId = (
    firstEnv(env, ["GOOGLE_IOS_CLIENT_ID", "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID"]) ||
    base.googleIosClientId?.trim() ||
    DEFAULT_GOOGLE_IOS_CLIENT_ID
  ).trim()

  return {
    ...base,
    portalApiUrl,
    portalWebUrl,
    msalClientId,
    msalTenant,
    msalPortalApiScope,
    googleWebClientId,
    googleIosClientId,
  }
}

export type PhoneBuildConfigIssue = { field: string; message: string }

export type PhoneBuildPlatform = "android" | "ios" | "all"

/** Validates config required for preview/production device builds (not localhost dev). */
export function validatePhoneBuildExtra(
  extra: BuildExtra,
  platform: PhoneBuildPlatform = "all",
): PhoneBuildConfigIssue[] {
  const issues: PhoneBuildConfigIssue[] = []
  const url = extra.portalApiUrl ?? ""

  if (!url || url.includes("localhost") || url.includes("127.0.0.1")) {
    issues.push({
      field: "portalApiUrl",
      message: "Set PORTAL_API_URL (or EXPO_PUBLIC_PORTAL_API_URL) to a reachable HTTPS Portal API.",
    })
  } else if (!url.startsWith("https://")) {
    issues.push({
      field: "portalApiUrl",
      message: "Portal API URL should use HTTPS for device builds.",
    })
  }

  if (!extra.msalClientId?.trim()) {
    issues.push({
      field: "msalClientId",
      message: "Set MSAL_CLIENT_ID (Entra athlete portal / mobile public client ID).",
    })
  }

  if (!extra.msalPortalApiScope?.trim()) {
    issues.push({
      field: "msalPortalApiScope",
      message: "Set MSAL_PORTAL_API_SCOPE (e.g. api://{portal-api-app-id}/portal.read).",
    })
  }

  if (platform !== "android" && !extra.googleIosClientId?.trim()) {
    issues.push({
      field: "googleIosClientId",
      message: "Set GOOGLE_IOS_CLIENT_ID (Google Cloud iOS OAuth client for Capture).",
    })
  }

  return issues
}
