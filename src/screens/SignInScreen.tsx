import { useEffect, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import { useRoute } from "@react-navigation/native"
import { useAuth } from "@/auth/AuthProvider"
import { friendlyAppleSignInError } from "@/auth/appleSignInCore"
import { captureOAuthUrlFromRouteParams } from "@/auth/captureOAuthReturn"
import { pushCaptureOAuthUrl } from "@/auth/captureOAuthInbox"
import { googleSignInPlatform } from "@/auth/googleAuth"
import {
  fetchGoogleSignInConfig,
  friendlyGoogleSignInError,
  interpolatePlatformMessage,
  resolveGoogleSignInIds,
  type GoogleSignInConfigState,
} from "@/auth/googleSignInConfig"
import type { GoogleSignInClientIds } from "@/auth/googleSignInCore"
import { friendlyMicrosoftSignInError } from "@/auth/microsoftToken"
import { AppBootScreen } from "@/components/AppBootScreen"
import { useI18n } from "@/i18n/I18nProvider"
import { googleIosClientId, googleWebClientId, msalRedirectUri, portalApiUrl } from "@/config"

const bakedGoogleIds: GoogleSignInClientIds = { googleWebClientId, googleIosClientId }

export default function SignInScreen() {
  const { ready, signingIn, signInError, signInWithMicrosoft, signInWithGoogle, signInWithApple } = useAuth()
  const { messages } = useI18n()
  const route = useRoute()
  const oauthParams = (route.params ?? {}) as Record<string, string | string[] | undefined>
  const platform = googleSignInPlatform()
  const [googleState, setGoogleState] = useState<GoogleSignInConfigState>(() =>
    resolveGoogleSignInIds({ platform, fallback: bakedGoogleIds, fetched: null }),
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const url = captureOAuthUrlFromRouteParams(oauthParams as Record<string, string | string[] | undefined>)
    if (url) pushCaptureOAuthUrl(url)
  }, [oauthParams])

  useEffect(() => {
    void fetchGoogleSignInConfig(portalApiUrl, platform, bakedGoogleIds).then(setGoogleState)
  }, [platform])

  if (!ready) {
    return <AppBootScreen />
  }

  const googleMisconfigured = interpolatePlatformMessage(
    messages.auth.googleNativeClientMisconfigured,
    platform,
  )

  const onMicrosoft = () => {
    void (async () => {
      setError(null)
      try {
        await signInWithMicrosoft()
      } catch (err) {
        setError(
          friendlyMicrosoftSignInError(
            err,
            messages.auth.signInFailed,
            messages.auth.microsoftRedirectUnregistered,
            msalRedirectUri,
          ),
        )
      }
    })()
  }

  const onGoogle = () => {
    if (googleState.status !== "ready") return
    const ids = googleState.ids
    void (async () => {
      setError(null)
      try {
        await signInWithGoogle(ids)
      } catch (err) {
        setError(friendlyGoogleSignInError(err, messages.auth.signInFailed, googleMisconfigured))
      }
    })()
  }

  const onApple = () => {
    void (async () => {
      setError(null)
      try {
        await signInWithApple()
      } catch (err) {
        setError(friendlyAppleSignInError(err, messages.auth.signInFailed, messages.auth.appleUnavailable))
      }
    })()
  }

  const displayError = error
    ? error
    : signInError
      ? friendlyAppleSignInError(
          friendlyMicrosoftSignInError(
            friendlyGoogleSignInError(signInError, messages.auth.signInFailed, googleMisconfigured),
            messages.auth.signInFailed,
            messages.auth.microsoftRedirectUnregistered,
            msalRedirectUri,
          ),
          messages.auth.signInFailed,
          messages.auth.appleUnavailable,
        )
      : null

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{messages.auth.title}</Text>
      <Text style={styles.subtitle}>{messages.auth.subtitle}</Text>

      {displayError ? <Text style={styles.error}>{displayError}</Text> : null}

      {googleState.status === "loading" ? (
        <Pressable style={[styles.btnGoogle, styles.btnDisabled]} disabled>
          <ActivityIndicator color="#fff" />
          <Text style={styles.btnLoadingText}>{messages.auth.googleLoading}</Text>
        </Pressable>
      ) : null}

      {googleState.status === "ready" ? (
        <Pressable
          style={[styles.btnGoogle, signingIn && styles.btnDisabled]}
          disabled={signingIn}
          onPress={onGoogle}
        >
          {signingIn ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>{messages.auth.signInWithGoogle}</Text>
          )}
        </Pressable>
      ) : null}

      <Pressable
        style={[styles.btnMicrosoft, signingIn && styles.btnDisabled]}
        disabled={signingIn}
        onPress={onMicrosoft}
      >
        {signingIn ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>{messages.auth.signInWithMicrosoft}</Text>
        )}
      </Pressable>

      <Pressable
        style={[styles.btnApple, signingIn && styles.btnDisabled]}
        disabled={signingIn}
        onPress={onApple}
      >
        {signingIn ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>{messages.auth.signInWithApple}</Text>
        )}
      </Pressable>

      {googleState.status === "unavailable" ? (
        <Text style={styles.hint}>{messages.auth.googleUnavailable}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#020617",
    padding: 24,
    justifyContent: "center",
  },
  title: { color: "#f8fafc", fontSize: 28, fontWeight: "800", textAlign: "center", marginBottom: 12 },
  subtitle: { color: "#94a3b8", fontSize: 15, textAlign: "center", marginBottom: 24 },
  error: { color: "#f87171", fontSize: 14, textAlign: "center", marginBottom: 12 },
  hint: { color: "#64748b", fontSize: 13, textAlign: "center", marginTop: 16 },
  btnGoogle: {
    backgroundColor: "#4285f4",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  btnMicrosoft: {
    backgroundColor: "#0284c7",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  btnApple: {
    backgroundColor: "#000000",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.65 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  btnLoadingText: { color: "#fff", fontWeight: "700", fontSize: 16, marginTop: 8 },
})
