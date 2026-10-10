import { useEffect, useState } from "react"
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native"
import { useRoute, type RouteProp } from "@react-navigation/native"
import type { RootStackParamList } from "@/navigation/types"
import { getStatProgress } from "@morphos/portal-api-client"
import { portalClientConfig } from "@/auth/tokenStore"
import { useAuth } from "@/auth/AuthProvider"
import { AppBootScreen } from "@/components/AppBootScreen"

export default function VideoDetailScreen() {
  const { ready } = useAuth()
  const { id } = useRoute<RouteProp<RootStackParamList, "VideoDetail">>().params
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const cfg = await portalClientConfig()
        if (!cfg || !id) return
        const progress = await getStatProgress(cfg, id)
        setData(progress)
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  if (!ready) return <AppBootScreen />

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#38bdf8" />
      </View>
    )
  }

  const stats = Array.isArray(data?.stats) ? (data?.stats as Record<string, unknown>[]) : []

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {stats.length === 0 ? (
        <Text style={styles.empty}>No stat progress available yet.</Text>
      ) : (
        stats.map((s, i) => (
          <View key={String(s.stat_key ?? i)} style={styles.row}>
            <Text style={styles.title}>{String(s.label ?? s.stat_key ?? "Stat")}</Text>
            <Text style={styles.meta}>Status: {String(s.status ?? "—")}</Text>
          </View>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617" },
  content: { padding: 16 },
  center: { flex: 1, backgroundColor: "#020617", alignItems: "center", justifyContent: "center" },
  empty: { color: "#94a3b8" },
  row: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  title: { color: "#f8fafc", fontWeight: "600" },
  meta: { color: "#94a3b8", marginTop: 4, fontSize: 13 },
})
