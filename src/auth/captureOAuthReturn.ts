export type OAuthReturnParams = {
  code: string | null
  idToken: string | null
  state: string | null
  error: string | null
  errorDescription: string | null
}

const OAUTH_KEYS = ["code", "id_token", "state", "error", "error_description"] as const

function trimParam(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  return trimmed || null
}

export function oauthParamsFromSearch(search: URLSearchParams | Record<string, string | undefined>): OAuthReturnParams {
  const get = (key: string): string | null => {
    if (search instanceof URLSearchParams) return trimParam(search.get(key))
    return trimParam(search[key])
  }
  return {
    code: get("code"),
    idToken: get("id_token"),
    state: get("state"),
    error: get("error"),
    errorDescription: get("error_description"),
  }
}

export function oauthReturnHasResult(params: OAuthReturnParams): boolean {
  return Boolean(params.code || params.idToken || params.error)
}

export function mergeOAuthReturnParams(
  primary: OAuthReturnParams | null,
  fallback: OAuthReturnParams | null,
): OAuthReturnParams | null {
  if (!primary && !fallback) return null
  const a = primary ?? emptyOAuthReturn()
  const b = fallback ?? emptyOAuthReturn()
  return {
    code: a.code ?? b.code,
    idToken: a.idToken ?? b.idToken,
    state: a.state ?? b.state,
    error: a.error ?? b.error,
    errorDescription: a.errorDescription ?? b.errorDescription,
  }
}

export function emptyOAuthReturn(): OAuthReturnParams {
  return { code: null, idToken: null, state: null, error: null, errorDescription: null }
}

function pathLooksLikeOAuthReturn(url: URL): boolean {
  const hostPath = `${url.hostname}${url.pathname}`.replace(/\/+$/, "")
  if (url.protocol === "morphoscapture:" && (url.hostname === "auth" || url.hostname === "sign-in")) return true
  if (url.pathname === "/auth" || url.pathname === "/sign-in" || url.pathname === "/capture/auth") return true
  return hostPath === "auth" || hostPath === "sign-in"
}

function searchParamsFromUrl(parsed: URL): URLSearchParams {
  const params = new URLSearchParams(parsed.search)
  const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash
  if (hash.includes("=")) {
    const hashParams = new URLSearchParams(hash)
    for (const [key, value] of hashParams) {
      if (!params.has(key)) params.set(key, value)
    }
  }
  return params
}

export function parseCaptureOAuthReturn(url: string): OAuthReturnParams | null {
  const trimmed = url.trim()
  if (!trimmed) return null
  try {
    const parsed = trimmed.includes("://") ? new URL(trimmed) : new URL(trimmed, "morphoscapture://host")
    if (!pathLooksLikeOAuthReturn(parsed)) return null
    const params = oauthParamsFromSearch(searchParamsFromUrl(parsed))
    return oauthReturnHasResult(params) ? params : null
  } catch {
    return null
  }
}

export function captureOAuthUrlFromRouteParams(
  params: Record<string, string | string[] | undefined>,
): string | null {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (!OAUTH_KEYS.includes(key as (typeof OAUTH_KEYS)[number]) && key !== "scope" && key !== "authuser") {
      continue
    }
    const raw = Array.isArray(value) ? value[0] : value
    if (typeof raw === "string" && raw.trim()) search.set(key, raw.trim())
  }
  const parsed = oauthParamsFromSearch(search)
  if (!oauthReturnHasResult(parsed)) return null
  return `morphoscapture://auth?${search.toString()}`
}

export function routeParamsToHrefParams(
  params: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    const raw = Array.isArray(value) ? value[0] : value
    if (typeof raw === "string" && raw.trim()) out[key] = raw.trim()
  }
  return out
}

export function oauthReturnMatchesState(params: OAuthReturnParams, expectedState?: string): boolean {
  const expected = expectedState?.trim()
  if (!expected || !params.state) return true
  return params.state === expected
}

export function authSessionSuccessUrl(result: { type: string; url?: string }): string | null {
  if (result.type !== "success") return null
  const url = result.url?.trim()
  return url || null
}

export type InteractiveOAuthSuccess = { ok: true; code: string | null; idToken: string | null }
export type InteractiveOAuthFailure = { ok: false; cancelled: boolean; message: string }

export function resolveInteractiveOAuthReturn(input: {
  promptType: string
  promptParams?: Record<string, string | undefined>
  returnUrl: string | null
  expectedState?: string
  cancelledMessage: string
  failedMessage: string
}): InteractiveOAuthSuccess | InteractiveOAuthFailure {
  const fromPrompt = input.promptParams ? oauthParamsFromSearch(input.promptParams) : null
  const fromUrl = input.returnUrl ? parseCaptureOAuthReturn(input.returnUrl) : null
  const merged = mergeOAuthReturnParams(fromPrompt, fromUrl)
  if (merged?.error) {
    const detail = [merged.error, merged.errorDescription].filter(Boolean).join(": ")
    return { ok: false, cancelled: false, message: detail || input.failedMessage }
  }
  if (merged && (merged.code || merged.idToken)) {
    if (!oauthReturnMatchesState(merged, input.expectedState)) {
      return { ok: false, cancelled: false, message: input.failedMessage }
    }
    return { ok: true, code: merged.code, idToken: merged.idToken }
  }
  if (input.promptType === "cancel" || input.promptType === "dismiss") {
    return { ok: false, cancelled: true, message: input.cancelledMessage }
  }
  return { ok: false, cancelled: false, message: input.failedMessage }
}
