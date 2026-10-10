export type RefreshedGoogleSession = {
  bearerToken: string
  expiresAt: number
}

export type MicrosoftSilentTokens = {
  accessToken: string
  refreshToken?: string | null
  expiresAt?: number | null
}

export type RefreshPortalBearerDeps = {
  loadAuthMethod: () => Promise<"microsoft" | "google" | "apple" | null>
  persistGoogleSession: (params: RefreshedGoogleSession) => Promise<void>
  persistMicrosoftSession: (params: MicrosoftSilentTokens) => Promise<void>
  persistAppleSession: (params: RefreshedGoogleSession) => Promise<void>
  restoreGoogleIdToken: () => Promise<string | null>
  acquireMicrosoftSilent: () => Promise<MicrosoftSilentTokens | null>
  exchangeGoogleIdToken: (idToken: string) => Promise<RefreshedGoogleSession | null>
}

export async function refreshPortalBearerOnce(deps: RefreshPortalBearerDeps): Promise<string | null> {
  const method = await deps.loadAuthMethod()
  if (method === "microsoft") {
    const silent = await deps.acquireMicrosoftSilent()
    if (!silent?.accessToken.trim()) return null
    await deps.persistMicrosoftSession(silent)
    return silent.accessToken.trim()
  }

  if (method === "apple") {
    return null
  }

  const idToken = await deps.restoreGoogleIdToken()
  if (!idToken?.trim()) return null
  const next = await deps.exchangeGoogleIdToken(idToken)
  if (!next?.bearerToken.trim()) return null
  await deps.persistGoogleSession(next)
  return next.bearerToken.trim()
}

export function createRefreshPortalBearer(deps: RefreshPortalBearerDeps): () => Promise<string | null> {
  let inFlight: Promise<string | null> | null = null
  return () => {
    if (inFlight) return inFlight
    inFlight = refreshPortalBearerOnce(deps).finally(() => {
      inFlight = null
    })
    return inFlight
  }
}
