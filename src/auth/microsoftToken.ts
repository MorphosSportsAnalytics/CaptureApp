export type MicrosoftTokens = {
  accessToken: string
  refreshToken: string | null
  expiresAt: number | null
}

export type MicrosoftDiscovery = {
  authorizationEndpoint: string
  tokenEndpoint: string
}

export const MICROSOFT_SIGN_IN_SCOPES = ["openid", "profile", "email", "offline_access"] as const

/** Interactive login for work + personal MSA. Do not include Portal API scopes here. */
export function microsoftSignInScopes(): string[] {
  return [...MICROSOFT_SIGN_IN_SCOPES]
}

export function microsoftApiScopes(portalApiScope: string): string[] {
  const signIn = microsoftSignInScopes()
  const api = portalApiScope.trim()
  return api ? [...signIn, api] : signIn
}

export function microsoftScopes(): string[] {
  return microsoftSignInScopes()
}

export function isMicrosoftRedirectUriError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes("redirect_uri") &&
    (lower.includes("not valid") ||
      lower.includes("invalid") ||
      lower.includes("not registered") ||
      lower.includes("does not match"))
  )
}

export function redirectUriFromAuthorizeUrl(url: string | undefined, fallback: string): string {
  if (!url?.trim()) return fallback
  try {
    const parsed = new URL(url)
    const fromQuery = parsed.searchParams.get("redirect_uri")?.trim()
    if (fromQuery) return fromQuery
  } catch {
    // Auth URLs that cannot be parsed keep the configured Capture redirect.
  }
  return fallback
}

export function interpolateRedirectMessage(template: string, uri: string): string {
  return template.replace(/\{uri\}/g, uri)
}

export function friendlyMicrosoftSignInError(
  err: unknown,
  fallback: string,
  redirectUnregistered: string,
  redirectUri?: string,
): string {
  const raw = err instanceof Error ? err.message.trim() : String(err ?? "").trim()
  if (!raw) return fallback
  if (isMicrosoftRedirectUriError(raw)) {
    return interpolateRedirectMessage(redirectUnregistered, redirectUri?.trim() || raw)
  }
  return raw
}

export function microsoftPromptErrorMessage(result: {
  type: string
  errorCode?: string | null
  params?: Record<string, string | undefined>
}): string | null {
  if (result.type === "cancel" || result.type === "dismiss") {
    return "Sign-in was cancelled."
  }
  const params = result.params ?? {}
  const oauthError = [params.error, params.error_description].filter((part) => Boolean(part?.trim())).join(": ")
  if (result.type === "error" || params.error) {
    return oauthError || result.errorCode || "No access token returned from Microsoft sign-in."
  }
  return null
}

export function microsoftDiscovery(tenant: string): MicrosoftDiscovery {
  const base = `https://login.microsoftonline.com/${tenant.trim() || "common"}/oauth2/v2.0`
  return {
    authorizationEndpoint: `${base}/authorize`,
    tokenEndpoint: `${base}/token`,
  }
}

export function microsoftCodeExchangeBody(params: {
  clientId: string
  code: string
  redirectUri: string
  codeVerifier: string
}): URLSearchParams {
  return new URLSearchParams({
    client_id: params.clientId,
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  })
}

export function microsoftRefreshBody(params: {
  clientId: string
  refreshToken: string
  scope?: string
}): URLSearchParams {
  const body: Record<string, string> = {
    client_id: params.clientId,
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
  }
  if (params.scope?.trim()) body.scope = params.scope.trim()
  return new URLSearchParams(body)
}

export function parseMicrosoftTokenJson(json: unknown): MicrosoftTokens {
  if (!json || typeof json !== "object") {
    throw new Error("No access token returned from Microsoft sign-in.")
  }
  const row = json as Record<string, unknown>
  const accessToken = typeof row.access_token === "string" ? row.access_token.trim() : ""
  if (!accessToken) {
    throw new Error("No access token returned from Microsoft sign-in.")
  }
  const refreshToken = typeof row.refresh_token === "string" && row.refresh_token.trim() ? row.refresh_token.trim() : null
  const expiresIn = typeof row.expires_in === "number" ? row.expires_in : Number.parseInt(String(row.expires_in ?? ""), 10)
  const expiresAt = Number.isFinite(expiresIn) && expiresIn > 0 ? Math.floor(Date.now() / 1000) + expiresIn : null
  return { accessToken, refreshToken, expiresAt }
}

export async function postMicrosoftToken(
  tokenEndpoint: string,
  body: URLSearchParams,
  fetchFn: typeof fetch = fetch,
): Promise<MicrosoftTokens> {
  const res = await fetchFn(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })
  const json: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error("No access token returned from Microsoft sign-in.")
  }
  return parseMicrosoftTokenJson(json)
}
