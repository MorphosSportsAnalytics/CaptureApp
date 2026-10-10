import { useCallback, useEffect, useState } from "react"
import { View, Text, Pressable, StyleSheet, Switch, Linking } from "react-native"
import {
  getMyProfile,
  getMyVideoUploadAccess,
  getUploadLimits,
  uploadLimitsHasSubscription,
  getVideoQuotas,
  type VideoUploadAccess,
} from "@morphos/portal-api-client"
import { portalClientConfig } from "@/auth/tokenStore"
import { useAuth } from "@/auth/AuthProvider"
import { maxClipLengthLabel, t as translate } from "@morphos/mobile-i18n"
import { useI18n } from "@/i18n/I18nProvider"
import { portalWebUrl } from "@/config"
import { portalSubscriptionUrl } from "@/lib/portalSubscriptionUrl"

import { profileDisplayName } from "@/lib/profileDisplayName"
import { portalLoadErrorMessage } from "@/lib/portalLoadError"
import { AppBootScreen } from "@/components/AppBootScreen"

export default function AccountScreen() {
  const { signOut, ready } = useAuth()
  const { messages } = useI18n()
  const [maxDuration, setMaxDuration] = useState<number | null>(null)
  const [hasSubscription, setHasSubscription] = useState(false)
  const [autoSubmit, setAutoSubmit] = useState(true)
  const [poolCount, setPoolCount] = useState(0)
  const [athleteId, setAthleteId] = useState<string | undefined>()
  const [displayName, setDisplayName] = useState("")
  const [profileError, setProfileError] = useState("")
  const [uploadAccess, setUploadAccess] = useState<VideoUploadAccess | null>(null)

  useEffect(() => {
    void (async () => {
      const cfg = await portalClientConfig()
      if (!cfg) return
      try {
        const limits = await getUploadLimits(cfg)
        setMaxDuration(limits.maxDurationSeconds)
        setHasSubscription(uploadLimitsHasSubscription(limits))
        const quotas = await getVideoQuotas(cfg)
        setPoolCount(Array.isArray(quotas.pools) ? quotas.pools.length : 0)
        const profile = await getMyProfile(cfg)
        const id = typeof profile.row?.id === "string" ? profile.row.id : undefined
        setAthleteId(id)
        setDisplayName(profileDisplayName(profile.row))
        setUploadAccess(await getMyVideoUploadAccess(cfg))
        setProfileError("")
      } catch (err) {
        setProfileError(portalLoadErrorMessage(err, messages))
      }
    })()
  }, [messages])

  const openSubscribeWebsite = useCallback(() => {
    void Linking.openURL(portalSubscriptionUrl(portalWebUrl, athleteId))
  }, [athleteId])

  if (!ready) return <AppBootScreen />

  const subscriptionLabel = uploadAccess?.canPickVideos
    ? messages.account.subscriptionActive
    : uploadAccess?.athleteHasGuardian
      ? messages.account.guardianManaged
      : messages.account.subscriptionNeeded

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{messages.account.signedInAs}</Text>
      <Text style={styles.displayName}>{displayName || profileError || messages.account.profileLoading}</Text>
      <Text style={styles.label}>{messages.account.subscription}</Text>
      <Text style={styles.value}>{uploadAccess ? subscriptionLabel : "—"}</Text>
      {uploadAccess?.subscribeOnWebsite ? (
        <Pressable style={styles.btnPrimary} onPress={openSubscribeWebsite}>
          <Text style={styles.btnText}>{messages.capture.subscribeOnWebsite}</Text>
        </Pressable>
      ) : null}
      <Text style={styles.label}>{messages.account.quota}</Text>
      <Text style={styles.value}>
        {maxDuration != null
          ? `${maxClipLengthLabel(messages, { maxDurationSeconds: maxDuration, hasSubscription })} · ${translate(messages, "account.quotaPools", { count: poolCount })}`
          : "—"}
      </Text>
      <View style={styles.row}>
        <Text style={styles.label}>{messages.upload.autoSubmit}</Text>
        <Switch value={autoSubmit} onValueChange={setAutoSubmit} />
      </View>
      <Pressable style={styles.btnSecondary} onPress={() => void signOut()}>
        <Text style={styles.btnText}>{messages.account.signOut}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617", padding: 16, gap: 12 },
  label: { color: "#cbd5e1", fontSize: 14, fontWeight: "600" },
  displayName: { color: "#f8fafc", fontSize: 20, fontWeight: "700" },
  hint: { color: "#94a3b8", fontSize: 14 },
  value: { color: "#94a3b8", fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  btnPrimary: {
    backgroundColor: "#0284c7",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  btnSecondary: {
    backgroundColor: "#334155",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 24,
  },
  btnText: { color: "#fff", fontWeight: "700" },
})
