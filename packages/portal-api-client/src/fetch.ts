import { fetchWithTimeout } from "./timeout.js"

/** Same name as Morphos @morphos/entra-auth/headers — that package is not published. */
export const PORTAL_USER_BEARER_HEADER = "x-morphos-portal-user-bearer"

export type PortalApiClientConfig = {
  baseUrl: string
  bearerToken: string
  fetchImpl?: typeof fetch
  uploadTimeoutMs?: number
  defaultTimeoutMs?: number
  /** Remint a session bearer after 401; portalFetch retries the request once. */
  onUnauthorized?: () => Promise<string | null>
}

export type PortalFetchInit = RequestInit & {
  timeoutMs?: number
}

export function portalAuthHeaders(bearerToken: string): Record<string, string> {
  const token = bearerToken.trim()
  return {
    Authorization: `Bearer ${token}`,
    [PORTAL_USER_BEARER_HEADER]: token,
  }
}

export async function portalAuthorizedFetch(
  cfg: PortalApiClientConfig,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const fetchFn = cfg.fetchImpl ?? fetch
  const run = (token: string) => {
    const headers = new Headers(init.headers)
    for (const [k, v] of Object.entries(portalAuthHeaders(token))) headers.set(k, v)
    return fetchWithTimeout(fetchFn, url, { ...init, headers }, timeoutMs)
  }
  const first = await run(cfg.bearerToken)
  if (first.status !== 401 || !cfg.onUnauthorized) return first
  const next = await cfg.onUnauthorized()
  if (!next?.trim()) return first
  cfg.bearerToken = next.trim()
  return run(cfg.bearerToken)
}

export async function portalFetch(
  cfg: PortalApiClientConfig,
  path: string,
  init: PortalFetchInit = {},
): Promise<Response> {
  const base = cfg.baseUrl.replace(/\/$/, "")
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`
  const { timeoutMs: timeoutOverride, headers, ...reqInit } = init
  const timeoutMs = timeoutOverride ?? cfg.defaultTimeoutMs ?? 20_000
  return portalAuthorizedFetch(cfg, url, { ...reqInit, headers }, timeoutMs)
}

export async function portalJson<T>(
  cfg: PortalApiClientConfig,
  path: string,
  init: PortalFetchInit = {},
): Promise<{ ok: true; status: number; data: T } | { ok: false; status: number; data: unknown; error: string }> {
  const res = await portalFetch(cfg, path, init)
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok) {
    const err =
      data != null && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Request failed (${res.status})`
    return { ok: false, status: res.status, data, error: err }
  }
  return { ok: true, status: res.status, data: data as T }
}
