import { getMobileAppleAuthConfig } from "@morphos/portal-api-client"
import { appleAuth } from "@invertase/react-native-apple-authentication"
import { portalApiUrl, portalWebUrl } from "@/config"
import { acquireAppleIdentityToken, type AppleSignInBridge } from "./appleSignInCore"
import { parseCaptureOAuthReturn } from "./captureOAuthReturn"
import { openAuthSession } from "./openAuthSession"
import { randomUuid } from "./pkceAuthRequest"

const bridge: AppleSignInBridge = {
  isNativeAvailable: async () => appleAuth.isSupported,
  signInNative: async () => {
    const credential = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
    })
    return { identityToken: credential.identityToken ?? null }
  },
  openWebAuthSession: (authorizeUrl, redirectUri) => openAuthSession(authorizeUrl, redirectUri),
  isCancelledError: (err) => {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : ""
    const message = err instanceof Error ? err.message : String(err ?? "")
    return (
      code.includes("ERR_REQUEST_CANCELED") ||
      code.includes("1001") ||
      message.toLowerCase().includes("canceled") ||
      message.toLowerCase().includes("cancelled")
    )
  },
  randomState: () => randomUuid(),
}

export function appleWebRedirectUri(): string {
  return `${portalWebUrl.replace(/\/$/, "")}/capture/auth`
}

export function identityTokenFromReturnUrl(url: string): string | null {
  return parseCaptureOAuthReturn(url)?.idToken ?? null
}

export async function acquireAppleNativeIdentityToken(webClientId?: string | null): Promise<string> {
  let clientId = webClientId?.trim() ?? ""
  if (!appleAuth.isSupported && !clientId) {
    try {
      const cfg = await getMobileAppleAuthConfig(portalApiUrl)
      if (cfg.ok) clientId = cfg.data.clientId?.trim() ?? ""
    } catch {
      // Fall through to the unavailable error from acquireAppleIdentityToken.
    }
  }
  return acquireAppleIdentityToken(bridge, {
    webClientId: clientId,
    redirectUri: appleWebRedirectUri(),
    parseIdentityTokenFromUrl: identityTokenFromReturnUrl,
  })
}
