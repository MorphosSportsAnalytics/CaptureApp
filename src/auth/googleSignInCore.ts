export type GoogleSignInPlatform = "ios" | "android"

export type GoogleSignInClientIds = {
  googleWebClientId?: string
  googleIosClientId?: string
}

export type GoogleConfigureParams = {
  webClientId?: string
  iosClientId?: string
  offlineAccess: boolean
}

export type GoogleSignInResult = {
  type?: string
  data?: { idToken?: string | null } | null
} | null

export type GoogleSignInBridge = {
  configure: (params: GoogleConfigureParams) => void
  hasPlayServices: () => Promise<boolean>
  signIn: () => Promise<GoogleSignInResult>
  signInSilently: () => Promise<GoogleSignInResult>
  signOut: () => Promise<unknown>
  isCancelledError: (err: unknown) => boolean
}

export const GOOGLE_SIGN_IN_CANCELLED = "Sign-in was cancelled."
export const GOOGLE_SIGN_IN_FAILED = "Sign-in failed. Try again."
export const GOOGLE_SIGN_IN_UNCONFIGURED = "Google sign-in is not configured."

/**
 * Android authenticates by package name + SHA-1 and needs the web client id to mint an ID token.
 * iOS authenticates with its own OAuth client. Google mandates this split; neither uses a browser.
 */
export function googleConfigureParams(
  platform: GoogleSignInPlatform,
  ids: GoogleSignInClientIds,
): GoogleConfigureParams | null {
  const webClientId = ids.googleWebClientId?.trim() ?? ""
  const iosClientId = ids.googleIosClientId?.trim() ?? ""

  if (platform === "ios") {
    if (!iosClientId) return null
    return { iosClientId, ...(webClientId ? { webClientId } : {}), offlineAccess: false }
  }

  if (!webClientId) return null
  return { webClientId, offlineAccess: false }
}

export function googleSignInAvailable(platform: GoogleSignInPlatform, ids: GoogleSignInClientIds): boolean {
  return googleConfigureParams(platform, ids) !== null
}

export function idTokenFromSignInResult(result: GoogleSignInResult): string | null {
  const token = result?.data?.idToken
  return typeof token === "string" && token.trim() ? token.trim() : null
}

export function signInResultCancelled(result: GoogleSignInResult): boolean {
  return result?.type === "cancelled"
}

export async function acquireGoogleIdToken(
  bridge: GoogleSignInBridge,
  platform: GoogleSignInPlatform,
  ids: GoogleSignInClientIds,
): Promise<string> {
  const params = googleConfigureParams(platform, ids)
  if (!params) throw new Error(GOOGLE_SIGN_IN_UNCONFIGURED)

  bridge.configure(params)
  try {
    if (platform === "android") {
      await bridge.hasPlayServices()
    }
    const result = await bridge.signIn()
    if (signInResultCancelled(result)) throw new Error(GOOGLE_SIGN_IN_CANCELLED)
    const idToken = idTokenFromSignInResult(result)
    if (!idToken) throw new Error(GOOGLE_SIGN_IN_FAILED)
    return idToken
  } catch (err) {
    if (bridge.isCancelledError(err)) throw new Error(GOOGLE_SIGN_IN_CANCELLED)
    throw err
  }
}

export async function restoreGoogleIdToken(
  bridge: GoogleSignInBridge,
  platform: GoogleSignInPlatform,
  ids: GoogleSignInClientIds,
): Promise<string | null> {
  const params = googleConfigureParams(platform, ids)
  if (!params) return null
  try {
    bridge.configure(params)
    return idTokenFromSignInResult(await bridge.signInSilently())
  } catch {
    return null
  }
}

export async function signOutGoogleSession(
  bridge: GoogleSignInBridge,
  platform: GoogleSignInPlatform,
  ids: GoogleSignInClientIds,
): Promise<void> {
  const params = googleConfigureParams(platform, ids)
  if (!params) return
  try {
    bridge.configure(params)
    await bridge.signOut()
  } catch {
    // The local Morphos session is cleared regardless of what the Google SDK reports.
  }
}
