import { useEffect, useState } from "react"
import { Image, View, Text, StyleSheet } from "react-native"
import type { PortalApiClientConfig } from "@morphos/portal-api-client"
import { loadCachedAthletePhotoUri } from "@/lib/athletePhotoCache"

type Props = {
  cfg: PortalApiClientConfig
  athleteId: string
  kind: "action_shot" | "mugshot"
  updatedAt?: string | null
  initials: string
}

export function AthleteAvatar({ cfg, athleteId, kind, updatedAt, initials }: Props) {
  const [localUri, setLocalUri] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setFailed(false)
    setLocalUri(null)
    void (async () => {
      try {
        const uri = await loadCachedAthletePhotoUri(cfg, athleteId, kind, updatedAt)
        if (cancelled) return
        if (!uri) {
          setFailed(true)
          return
        }
        setLocalUri(uri)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cfg, athleteId, kind, updatedAt])

  if (failed || !localUri) {
    return (
      <View style={styles.initials}>
        <Text style={styles.initialsText}>{initials}</Text>
      </View>
    )
  }

  return (
    <Image
      source={{ uri: localUri }}
      style={styles.photo}
      accessibilityIgnoresInvertColors
      onError={() => setFailed(true)}
    />
  )
}

const styles = StyleSheet.create({
  photo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#334155",
  },
  initials: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  initialsText: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "700",
  },
})
