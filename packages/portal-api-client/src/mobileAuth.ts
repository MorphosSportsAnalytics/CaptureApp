import { fetchWithTimeout } from "./timeout.js"

export type MobileGoogleAuthConfig = {
  /** Web client id: the ID token audience for Android sign-in. */
  clientId: string
  /** iOS OAuth client id, when Portal API has one configured. */
  iosClientId?: string | null
}

export type MobileAuthUser = {
  id: string
  email: string
  role: string
  displayName: string | null
}

export type MobileGoogleSignInResponse = {
  bearerToken: string
  expiresAt: number
  sessionExpSec: number
  user: MobileAuthUser
}

export type MobileAppleAuthConfig = {
  bundleId: string
  clientId: string | null
}

export type MobileAppleSignInResponse = MobileGoogleSignInResponse

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

function errorFromBody(data: unknown, status: number): string {
  if (data != null && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string") {
    return (data as { error: string }).error
  }
  return `Request failed (${status})`
}

function parseGoogleConfig(data: unknown): MobileGoogleAuthConfig | null {
  if (data == null || typeof data !== "object") return null
  const row = data as Record<string, unknown>
  const clientId = typeof row.clientId === "string" ? row.clientId.trim() : ""
  if (!clientId) return null
  const iosClientId = typeof row.iosClientId === "string" && row.iosClientId.trim() ? row.iosClientId.trim() : null
  return { clientId, iosClientId }
}

export async function getMobileGoogleAuthConfig(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; data: MobileGoogleAuthConfig } | { ok: false; error: string; status: number }> {
  const url = `${baseUrl.replace(/\/$/, "")}/v1/public/mobile-auth/google-config`
  try {
    const res = await fetchWithTimeout(fetchImpl, url, {}, 20_000)
    const data = await readJson(res)
    if (!res.ok) {
      return { ok: false, error: errorFromBody(data, res.status), status: res.status }
    }
    const parsed = parseGoogleConfig(data)
    if (!parsed) return { ok: false, error: "Invalid google-config response", status: res.status }
    return { ok: true, data: parsed }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error"
    return { ok: false, error: message, status: 0 }
  }
}

export async function signInWithGoogleIdToken(
  baseUrl: string,
  idToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; data: MobileGoogleSignInResponse } | { ok: false; error: string; status: number }> {
  const url = `${baseUrl.replace(/\/$/, "")}/v1/public/mobile-auth/google-signin`
  const res = await fetchWithTimeout(
    fetchImpl,
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
    20_000,
  )
  const data = await readJson(res)
  if (!res.ok) {
    return { ok: false, error: errorFromBody(data, res.status), status: res.status }
  }
  if (
    data == null ||
    typeof data !== "object" ||
    !("bearerToken" in data) ||
    typeof (data as { bearerToken: unknown }).bearerToken !== "string"
  ) {
    return { ok: false, error: "Invalid google-signin response", status: res.status }
  }
  return { ok: true, data: data as MobileGoogleSignInResponse }
}

function parseAppleConfig(data: unknown): MobileAppleAuthConfig | null {
  if (data == null || typeof data !== "object") return null
  const row = data as Record<string, unknown>
  const bundleId = typeof row.bundleId === "string" ? row.bundleId.trim() : ""
  if (!bundleId) return null
  const clientId = typeof row.clientId === "string" && row.clientId.trim() ? row.clientId.trim() : null
  return { bundleId, clientId }
}

export async function getMobileAppleAuthConfig(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; data: MobileAppleAuthConfig } | { ok: false; error: string; status: number }> {
  const url = `${baseUrl.replace(/\/$/, "")}/v1/public/mobile-auth/apple-config`
  try {
    const res = await fetchWithTimeout(fetchImpl, url, {}, 20_000)
    const data = await readJson(res)
    if (!res.ok) {
      return { ok: false, error: errorFromBody(data, res.status), status: res.status }
    }
    const parsed = parseAppleConfig(data)
    if (!parsed) return { ok: false, error: "Invalid apple-config response", status: res.status }
    return { ok: true, data: parsed }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error"
    return { ok: false, error: message, status: 0 }
  }
}

export async function signInWithAppleIdentityToken(
  baseUrl: string,
  identityToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; data: MobileAppleSignInResponse } | { ok: false; error: string; status: number }> {
  const url = `${baseUrl.replace(/\/$/, "")}/v1/public/mobile-auth/apple-signin`
  const res = await fetchWithTimeout(
    fetchImpl,
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identityToken }),
    },
    20_000,
  )
  const data = await readJson(res)
  if (!res.ok) {
    return { ok: false, error: errorFromBody(data, res.status), status: res.status }
  }
  if (
    data == null ||
    typeof data !== "object" ||
    !("bearerToken" in data) ||
    typeof (data as { bearerToken: unknown }).bearerToken !== "string"
  ) {
    return { ok: false, error: "Invalid apple-signin response", status: res.status }
  }
  return { ok: true, data: data as MobileAppleSignInResponse }
}
