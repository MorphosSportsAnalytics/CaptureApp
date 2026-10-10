import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { Linking } from "react-native"
import { signInWithAppleIdentityToken, signInWithGoogleIdToken } from "@morphos/portal-api-client"
import { portalApiUrl } from "@/config"
import { recordBootPhase } from "@/diagnostics/bootLog"
import { withTimeout } from "@/lib/withTimeout"
import { acquireAppleNativeIdentityToken } from "./appleAuth"
import { pushCaptureOAuthUrl } from "./captureOAuthInbox"
import { acquireGoogleNativeIdToken, signOutGoogleAccount } from "./googleAuth"
import type { GoogleSignInClientIds } from "./googleSignInCore"
import {
  acquireMicrosoftTokenInteractive,
  acquireMicrosoftTokenSilent,
  signOutMicrosoftAccount,
} from "./msalAuth"
import {
  clearAuthStorage,
  loadAuthMethod,
  loadBearerExpiresAt,
  loadBearerToken,
  persistAppleSession,
  persistGoogleSession,
  persistMicrosoftSession,
  remintStoredPortalBearer,
} from "./tokenStore"

type AuthContextValue = {
  ready: boolean
  signedIn: boolean
  signingIn: boolean
  signInError: string | null
  signInWithMicrosoft: () => Promise<void>
  signInWithGoogle: (ids?: GoogleSignInClientIds) => Promise<void>
  signInWithApple: () => Promise<void>
  completeGoogleSignIn: (idToken: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const REFRESH_SKEW_SEC = 300
const SESSION_RESTORE_TIMEOUT_MS = 12_000
const MSAL_SILENT_TIMEOUT_MS = 8_000

async function exchangeGoogleIdTokenForSession(idToken: string): Promise<boolean> {
  const result = await signInWithGoogleIdToken(portalApiUrl, idToken)
  if (!result.ok) return false
  await persistGoogleSession({
    bearerToken: result.data.bearerToken,
    expiresAt: result.data.expiresAt,
  })
  return true
}

/**
 * Keeps the user signed in past the Morphos bearer lifetime: Google restores the
 * account silently, and the fresh ID token buys a new Portal API session.
 */
async function restoreGoogleSession(): Promise<boolean> {
  try {
    const expiresAt = await loadBearerExpiresAt()
    const nowSec = Math.floor(Date.now() / 1000)
    const bearer = await loadBearerToken()
    if (bearer?.trim() && expiresAt && expiresAt > nowSec + REFRESH_SKEW_SEC) {
      return true
    }

    if (await remintStoredPortalBearer()) return true
    return Boolean(bearer?.trim())
  } catch {
    const bearer = await loadBearerToken()
    return Boolean(bearer?.trim())
  }
}

async function restoreMicrosoftSession(): Promise<boolean> {
  const silent = await withTimeout(acquireMicrosoftTokenSilent(), MSAL_SILENT_TIMEOUT_MS, null)
  if (silent) {
    await persistMicrosoftSession(silent)
    return true
  }
  const stored = await loadBearerToken()
  return Boolean(stored?.trim())
}

async function restoreAppleSession(): Promise<boolean> {
  try {
    const expiresAt = await loadBearerExpiresAt()
    const nowSec = Math.floor(Date.now() / 1000)
    const bearer = await loadBearerToken()
    if (bearer?.trim() && expiresAt && expiresAt > nowSec + REFRESH_SKEW_SEC) {
      return true
    }
    return Boolean(bearer?.trim())
  } catch {
    const bearer = await loadBearerToken()
    return Boolean(bearer?.trim())
  }
}

async function restoreStoredSession(): Promise<boolean> {
  const method = await loadAuthMethod()
  if (method === "google") return restoreGoogleSession()
  if (method === "microsoft") return restoreMicrosoftSession()
  if (method === "apple") return restoreAppleSession()
  const legacy = await loadBearerToken()
  return Boolean(legacy?.trim())
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const [signInError, setSignInError] = useState<string | null>(null)

  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      pushCaptureOAuthUrl(url)
    })
    void Linking.getInitialURL().then((url) => {
      if (url) pushCaptureOAuthUrl(url)
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    void (async () => {
      recordBootPhase("restoringSession")
      try {
        const ok = await withTimeout(restoreStoredSession(), SESSION_RESTORE_TIMEOUT_MS, false)
        setSignedIn(ok)
      } catch {
        setSignedIn(false)
      } finally {
        recordBootPhase("sessionReady")
        setReady(true)
      }
    })()
  }, [])

  const signInWithMicrosoft = useCallback(async () => {
    setSigningIn(true)
    setSignInError(null)
    try {
      const token = await acquireMicrosoftTokenInteractive()
      await persistMicrosoftSession(token)
      setSignedIn(true)
    } catch (err) {
      const message = err instanceof Error ? err.message.trim() : String(err ?? "")
      setSignInError(message || "Sign-in failed. Try again.")
      throw err
    } finally {
      setSigningIn(false)
    }
  }, [])

  const completeGoogleSignIn = useCallback(async (idToken: string) => {
    const result = await signInWithGoogleIdToken(portalApiUrl, idToken)
    if (!result.ok) {
      throw new Error(result.error)
    }
    await persistGoogleSession({
      bearerToken: result.data.bearerToken,
      expiresAt: result.data.expiresAt,
    })
    setSignedIn(true)
  }, [])

  const signInWithGoogle = useCallback(
    async (ids?: GoogleSignInClientIds) => {
      setSigningIn(true)
      setSignInError(null)
      try {
        const idToken = await acquireGoogleNativeIdToken(ids)
        await completeGoogleSignIn(idToken)
      } catch (err) {
        const message = err instanceof Error ? err.message.trim() : String(err ?? "")
        setSignInError(message || "Sign-in failed. Try again.")
        throw err
      } finally {
        setSigningIn(false)
      }
    },
    [completeGoogleSignIn],
  )

  const signInWithApple = useCallback(async () => {
    setSigningIn(true)
    setSignInError(null)
    try {
      const identityToken = await acquireAppleNativeIdentityToken()
      const result = await signInWithAppleIdentityToken(portalApiUrl, identityToken)
      if (!result.ok) {
        throw new Error(result.error)
      }
      await persistAppleSession({
        bearerToken: result.data.bearerToken,
        expiresAt: result.data.expiresAt,
      })
      setSignedIn(true)
    } catch (err) {
      const message = err instanceof Error ? err.message.trim() : String(err ?? "")
      setSignInError(message || "Sign-in failed. Try again.")
      throw err
    } finally {
      setSigningIn(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    const method = await loadAuthMethod()
    if (method === "microsoft") {
      await signOutMicrosoftAccount()
    }
    if (method === "google") {
      await signOutGoogleAccount()
    }
    await clearAuthStorage()
    setSignedIn(false)
  }, [])

  const value = useMemo(
    () => ({
      ready,
      signedIn,
      signingIn,
      signInError,
      signInWithMicrosoft,
      signInWithGoogle,
      signInWithApple,
      completeGoogleSignIn,
      signOut,
    }),
    [ready, signedIn, signingIn, signInError, signInWithMicrosoft, signInWithGoogle, signInWithApple, completeGoogleSignIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
