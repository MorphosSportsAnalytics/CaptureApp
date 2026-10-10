export type AppleSignInWebParams = {
  clientId: string
  redirectUri: string
  state: string
}

export type AppleSignInResult = {
  identityToken: string | null
  cancelled?: boolean
}

export type AppleAuthSessionResult = {
  type: string
  url?: string
}

export type AppleSignInBridge = {
  isNativeAvailable: () => Promise<boolean>
  signInNative: () => Promise<AppleSignInResult>
  openWebAuthSession: (authorizeUrl: string, redirectUri: string) => Promise<AppleAuthSessionResult>
  isCancelledError: (err: unknown) => boolean
  randomState: () => string
}

export const APPLE_SIGN_IN_CANCELLED = "Sign-in was cancelled."
export const APPLE_SIGN_IN_FAILED = "Sign-in failed. Try again."
export const APPLE_SIGN_IN_UNAVAILABLE = "Apple sign-in is not available."

export function friendlyAppleSignInError(err: unknown, fallback: string, unavailable: string): string {
  const raw = err instanceof Error ? err.message.trim() : String(err ?? "").trim()
  if (!raw) return fallback
  if (raw === APPLE_SIGN_IN_UNAVAILABLE || raw.toLowerCase().includes("not available")) return unavailable
  return raw
}

const APPLE_AUTHORIZE_URL = "https://appleid.apple.com/auth/authorize"

export function appleWebAuthorizeUrl(params: AppleSignInWebParams): string {
  const query = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "id_token",
    response_mode: "fragment",
    state: params.state,
  })
  return `${APPLE_AUTHORIZE_URL}?${query.toString()}`
}

export function identityTokenFromAppleResult(result: AppleSignInResult): string | null {
  const token = result.identityToken
  return typeof token === "string" && token.trim() ? token.trim() : null
}

export type ParseIdentityTokenFromUrl = (url: string) => string | null

export async function acquireAppleIdentityToken(
  bridge: AppleSignInBridge,
  options: {
    webClientId?: string | null
    redirectUri: string
    parseIdentityTokenFromUrl: ParseIdentityTokenFromUrl
  },
): Promise<string> {
  try {
    if (await bridge.isNativeAvailable()) {
      const result = await bridge.signInNative()
      if (result.cancelled) throw new Error(APPLE_SIGN_IN_CANCELLED)
      const token = identityTokenFromAppleResult(result)
      if (!token) throw new Error(APPLE_SIGN_IN_FAILED)
      return token
    }

    const clientId = options.webClientId?.trim() ?? ""
    if (!clientId) throw new Error(APPLE_SIGN_IN_UNAVAILABLE)

    const state = bridge.randomState()
    const authorizeUrl = appleWebAuthorizeUrl({
      clientId,
      redirectUri: options.redirectUri,
      state,
    })
    const session = await bridge.openWebAuthSession(authorizeUrl, options.redirectUri)
    if (session.type === "cancel" || session.type === "dismiss") {
      throw new Error(APPLE_SIGN_IN_CANCELLED)
    }
    const returnUrl = session.type === "success" ? session.url?.trim() ?? "" : ""
    const token = returnUrl ? options.parseIdentityTokenFromUrl(returnUrl) : null
    if (!token) throw new Error(APPLE_SIGN_IN_FAILED)
    return token
  } catch (err) {
    if (bridge.isCancelledError(err)) throw new Error(APPLE_SIGN_IN_CANCELLED)
    throw err
  }
}
