import { useEffect, useState } from "react"
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { getMyVideos } from "@morphos/portal-api-client"
import { portalClientConfig } from "@/auth/tokenStore"
import { useAuth } from "@/auth/AuthProvider"
import { useI18n } from "@/i18n/I18nProvider"

export default function VideosScreen() {
  const navigation = useNavigation()
  const { signedIn } = useAuth()
  const { messages } = useI18n()
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      if (!signedIn) {
        setLoading(false)
        return
      }
      try {
        const cfg = await portalClientConfig()
        if (!cfg) return
        const data = await getMyVideos(cfg)
        setRows(data.rows ?? [])
      } finally {
        setLoading(false)
      }
    })()
  }, [signedIn])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#38bdf8" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.id ?? Math.random())}
        ListEmptyComponent={<Text style={styles.empty}>{messages.videos.empty}</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate("VideoDetail", { id: String(item.id) })}
          >
            <Text style={styles.title}>{String(item.title ?? "Video")}</Text>
            <Text style={styles.meta}>
              {messages.videos.status}: {String(item.status ?? "—")}
            </Text>
          </Pressable>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617", padding: 16 },
  center: { flex: 1, backgroundColor: "#020617", alignItems: "center", justifyContent: "center" },
  empty: { color: "#94a3b8", textAlign: "center", marginTop: 40 },
  row: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  title: { color: "#f8fafc", fontSize: 16, fontWeight: "600" },
  meta: { color: "#94a3b8", fontSize: 13, marginTop: 4 },
})
