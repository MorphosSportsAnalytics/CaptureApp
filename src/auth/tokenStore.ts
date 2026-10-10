import type { PortalApiClientConfig } from "@morphos/portal-api-client"
import { portalApiUrl } from "../config"
import * as SecureStore from "./secureStorage"

const TOKEN_KEY = "morphos_portal_bearer"
const AUTH_METHOD_KEY = "morphos_auth_method"
const GOOGLE_REFRESH_KEY = "morphos_google_refresh"
const MICROSOFT_REFRESH_KEY = "morphos_microsoft_refresh"
const BEARER_EXPIRES_KEY = "morphos_bearer_expires"

export type StoredAuthMethod = "microsoft" | "google" | "apple"

export async function saveBearerToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token)
}

export async function loadBearerToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY)
}

export async function saveAuthMethod(method: StoredAuthMethod): Promise<void> {
  await SecureStore.setItemAsync(AUTH_METHOD_KEY, method)
}

export async function loadAuthMethod(): Promise<StoredAuthMethod | null> {
  const raw = await SecureStore.getItemAsync(AUTH_METHOD_KEY)
  return raw === "microsoft" || raw === "google" || raw === "apple" ? raw : null
}

export async function saveBearerExpiresAt(expiresAtSec: number): Promise<void> {
  await SecureStore.setItemAsync(BEARER_EXPIRES_KEY, String(expiresAtSec))
}

export async function loadBearerExpiresAt(): Promise<number | null> {
  const raw = await SecureStore.getItemAsync(BEARER_EXPIRES_KEY)
  if (!raw?.trim()) return null
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : null
}

export async function clearBearerToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY)
}

export async function saveMicrosoftRefreshToken(refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(MICROSOFT_REFRESH_KEY, refreshToken)
}

export async function loadMicrosoftRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(MICROSOFT_REFRESH_KEY)
}

export async function clearAuthStorage(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(AUTH_METHOD_KEY),
    SecureStore.deleteItemAsync(GOOGLE_REFRESH_KEY),
    SecureStore.deleteItemAsync(MICROSOFT_REFRESH_KEY),
    SecureStore.deleteItemAsync(BEARER_EXPIRES_KEY),
  ])
}

let refreshStoredPortalBearer: (() => Promise<string | null>) | null = null

export async function remintStoredPortalBearer(): Promise<string | null> {
  if (!refreshStoredPortalBearer) {
    const { createRefreshPortalBearer } = await import("./refreshPortalBearer")
    const { restoreGoogleNativeIdToken } = await import("./googleAuth")
    const { acquireMicrosoftTokenSilent } = await import("./msalAuth")
    const { signInWithGoogleIdToken } = await import("@morphos/portal-api-client")
    refreshStoredPortalBearer = createRefreshPortalBearer({
      loadAuthMethod,
      persistGoogleSession,
      persistMicrosoftSession,
      persistAppleSession,
      restoreGoogleIdToken: restoreGoogleNativeIdToken,
      acquireMicrosoftSilent: acquireMicrosoftTokenSilent,
      exchangeGoogleIdToken: async (idToken) => {
        const result = await signInWithGoogleIdToken(portalApiUrl, idToken)
        if (!result.ok) return null
        return { bearerToken: result.data.bearerToken, expiresAt: result.data.expiresAt }
      },
    })
  }
  return refreshStoredPortalBearer()
}

export async function portalClientConfig(): Promise<PortalApiClientConfig | null> {
  const bearerToken = await loadBearerToken()
  if (!bearerToken?.trim()) return null
  return { baseUrl: portalApiUrl, bearerToken, onUnauthorized: remintStoredPortalBearer }
}

/** Apple keeps the credential in the OS; Morphos only stores the Portal API bearer. */
export async function persistAppleSession(params: {
  bearerToken: string
  expiresAt: number
}): Promise<void> {
  await saveBearerToken(params.bearerToken)
  await saveAuthMethod("apple")
  await saveBearerExpiresAt(params.expiresAt)
  await SecureStore.deleteItemAsync(GOOGLE_REFRESH_KEY)
}

/** Google itself keeps the account signed in; Morphos only stores the Portal API bearer. */
export async function persistGoogleSession(params: {
  bearerToken: string
  expiresAt: number
}): Promise<void> {
  await saveBearerToken(params.bearerToken)
  await saveAuthMethod("google")
  await saveBearerExpiresAt(params.expiresAt)
  await SecureStore.deleteItemAsync(GOOGLE_REFRESH_KEY)
}

export async function persistMicrosoftSession(params: {
  accessToken: string
  refreshToken?: string | null
  expiresAt?: number | null
}): Promise<void> {
  await saveBearerToken(params.accessToken)
  await saveAuthMethod("microsoft")
  if (params.expiresAt && Number.isFinite(params.expiresAt)) {
    await saveBearerExpiresAt(params.expiresAt)
  } else {
    await SecureStore.deleteItemAsync(BEARER_EXPIRES_KEY)
  }
  if (params.refreshToken?.trim()) {
    await saveMicrosoftRefreshToken(params.refreshToken.trim())
  } else {
    await SecureStore.deleteItemAsync(MICROSOFT_REFRESH_KEY)
  }
  await SecureStore.deleteItemAsync(GOOGLE_REFRESH_KEY)
}
