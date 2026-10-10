import { withTimeout } from "@/lib/withTimeout"
import { msalClientId, msalPortalApiScope, msalRedirectUri, msalTenant } from "@/config"
import { takeCaptureOAuthUrl, waitForCaptureOAuthUrl, clearCaptureOAuthInbox } from "./captureOAuthInbox"
import { authSessionSuccessUrl, resolveInteractiveOAuthReturn } from "./captureOAuthReturn"
import { createPkceAuthRequest } from "./pkceAuthRequest"
import { openAuthSession } from "./openAuthSession"
import { loadMicrosoftRefreshToken } from "./tokenStore"
import {
  microsoftApiScopes,
  microsoftCodeExchangeBody,
  microsoftDiscovery,
  microsoftPromptErrorMessage,
  microsoftRefreshBody,
  microsoftSignInScopes,
  postMicrosoftToken,
  redirectUriFromAuthorizeUrl,
  type MicrosoftTokens,
} from "./microsoftToken"

export type { MicrosoftTokens }

function requireClientId(): string {
  const clientId = msalClientId.trim()
  if (!clientId) {
    throw new Error("Microsoft sign-in is not configured (missing client ID).")
  }
  return clientId
}

export async function acquireMicrosoftTokenInteractive(): Promise<MicrosoftTokens> {
  const clientId = requireClientId()
  const discovery = microsoftDiscovery(msalTenant)
  const request = createPkceAuthRequest({
    clientId,
    scopes: microsoftSignInScopes(),
    redirectUri: msalRedirectUri,
    authorizationEndpoint: discovery.authorizationEndpoint,
    extraParams: { prompt: "select_account" },
  })
  const usedRedirect = redirectUriFromAuthorizeUrl(request.url, msalRedirectUri)
  clearCaptureOAuthInbox()
  const pending = waitForCaptureOAuthUrl(20_000)
  const result = await openAuthSession(request.url, usedRedirect)
  const returnUrl =
    authSessionSuccessUrl(result) ?? takeCaptureOAuthUrl() ?? (await withTimeout(pending, 8_000, null))
  const recovered = resolveInteractiveOAuthReturn({
    promptType: result.type,
    promptParams: undefined,
    returnUrl,
    expectedState: request.state,
    cancelledMessage: "Sign-in was cancelled.",
    failedMessage: "No access token returned from Microsoft sign-in.",
  })
  if (recovered.ok && recovered.code) {
    return postMicrosoftToken(
      discovery.tokenEndpoint,
      microsoftCodeExchangeBody({
        clientId,
        code: recovered.code,
        redirectUri: usedRedirect,
        codeVerifier: request.codeVerifier,
      }),
    )
  }
  const promptError = microsoftPromptErrorMessage({
    type: result.type,
    params: undefined,
  })
  if (promptError) {
    throw new Error(
      isRedirectPrompt(promptError) ? `${promptError} redirect_uri=${usedRedirect}` : promptError,
    )
  }
  throw new Error(recovered.ok ? "No access token returned from Microsoft sign-in." : recovered.message)
}

function isRedirectPrompt(message: string): boolean {
  return message.toLowerCase().includes("redirect_uri") || message.toLowerCase().includes("invalid_request")
}

export async function acquireMicrosoftTokenSilent(): Promise<MicrosoftTokens | null> {
  if (!msalClientId.trim()) return null
  const refreshToken = await loadMicrosoftRefreshToken()
  if (!refreshToken?.trim()) return null
  try {
    return await postMicrosoftToken(
      microsoftDiscovery(msalTenant).tokenEndpoint,
      microsoftRefreshBody({
        clientId: msalClientId.trim(),
        refreshToken: refreshToken.trim(),
        scope: microsoftApiScopes(msalPortalApiScope).join(" "),
      }),
    )
  } catch {
    return null
  }
}

export async function signOutMicrosoftAccount(): Promise<void> {
  /* Browser-session sign-out is best-effort; tokens are cleared in tokenStore. */
}
