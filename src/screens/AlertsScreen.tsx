import { useCallback, useEffect, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import { getNotifications, markNotificationsRead, type PortalApiClientConfig } from "@morphos/portal-api-client"
import { portalClientConfig } from "@/auth/tokenStore"
import { useI18n } from "@/i18n/I18nProvider"
import { portalLoadErrorMessage } from "@/lib/portalLoadError"
import {
  formatAlertCreatedAt,
  mapPortalAlerts,
  unreadPortalAlerts,
  videoDetailPath,
  withoutAlertIds,
  type PortalAlert,
} from "@/lib/portalNotifications"

export default function AlertsScreen() {
  const { locale, messages } = useI18n()
  const navigation = useNavigation()
  const [cfg, setCfg] = useState<PortalApiClientConfig | null>(null)
  const [alerts, setAlerts] = useState<PortalAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [pendingIds, setPendingIds] = useState<string[]>([])

  useEffect(() => {
    void (async () => {
      const nextCfg = await portalClientConfig()
      setCfg(nextCfg)
      if (!nextCfg) setLoading(false)
    })()
  }, [])

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!cfg) return
      if (mode === "refresh") setRefreshing(true)
      else setLoading(true)
      try {
        const data = await getNotifications(cfg, { unread: true })
        setAlerts(unreadPortalAlerts(mapPortalAlerts(data.notifications)))
        setLoadError("")
      } catch (err) {
        setLoadError(portalLoadErrorMessage(err, messages) || messages.notifications.loadFailed)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [cfg, messages],
  )

  useEffect(() => {
    if (!cfg) return
    void load("initial")
  }, [cfg, load])

  const dismiss = useCallback(
    async (ids: string[]) => {
      if (!cfg || ids.length === 0 || pendingIds.length > 0) return
      const previous = alerts
      setPendingIds(ids)
      setAlerts((current) => withoutAlertIds(current, ids))
      try {
        await markNotificationsRead(cfg, ids)
        setLoadError("")
      } catch (err) {
        setAlerts(previous)
        setLoadError(portalLoadErrorMessage(err, messages) || messages.notifications.loadFailed)
      } finally {
        setPendingIds([])
      }
    },
    [alerts, cfg, messages, pendingIds.length],
  )

  const openAlert = useCallback(
    (alert: PortalAlert) => {
      const path = videoDetailPath(alert)
      if (path) navigation.navigate("VideoDetail", { id: path.slice("/videos/".length) })
    },
    [navigation],
  )

  if (loading && alerts.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#38bdf8" />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      {alerts.length > 0 ? (
        <Pressable
          style={[styles.dismissAll, pendingIds.length > 0 ? styles.disabled : null]}
          onPress={() => void dismiss(alerts.map((alert) => alert.id))}
          disabled={pendingIds.length > 0}
        >
          <Text style={styles.dismissAllText}>{messages.notifications.dismissAll}</Text>
        </Pressable>
      ) : null}
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={alerts.length === 0 ? styles.emptyContent : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load("refresh")}
            tintColor="#38bdf8"
            colors={["#38bdf8"]}
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>{loadError || messages.notifications.empty}</Text>
        }
        ListHeaderComponent={
          loadError && alerts.length > 0 ? <Text style={styles.error}>{loadError}</Text> : null
        }
        renderItem={({ item }) => {
          const created = formatAlertCreatedAt(item.createdAt, locale)
          const dismissing = pendingIds.includes(item.id)
          return (
            <View style={styles.card}>
              <Pressable onPress={() => openAlert(item)} disabled={!videoDetailPath(item)}>
                <Text style={styles.title}>{item.title}</Text>
                {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
                {created ? <Text style={styles.meta}>{created}</Text> : null}
              </Pressable>
              <Pressable
                style={[styles.dismissBtn, dismissing ? styles.disabled : null]}
                onPress={() => void dismiss([item.id])}
                disabled={dismissing}
              >
                <Text style={styles.dismissBtnText}>{messages.notifications.dismiss}</Text>
              </Pressable>
            </View>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#020617" },
  center: { flex: 1, backgroundColor: "#020617", alignItems: "center", justifyContent: "center" },
  list: { padding: 16, paddingBottom: 32, gap: 12 },
  emptyContent: { flexGrow: 1, padding: 16, justifyContent: "center" },
  empty: { color: "#94a3b8", fontSize: 15, textAlign: "center" },
  error: { color: "#f87171", fontSize: 13, marginBottom: 8 },
  dismissAll: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#334155",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  dismissAllText: { color: "#f8fafc", fontWeight: "700" },
  card: {
    backgroundColor: "#0f172a",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  title: { color: "#f8fafc", fontSize: 16, fontWeight: "700" },
  body: { color: "#cbd5e1", fontSize: 14, marginTop: 4 },
  meta: { color: "#94a3b8", fontSize: 12, marginTop: 6 },
  dismissBtn: {
    backgroundColor: "#0284c7",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  dismissBtnText: { color: "#fff", fontWeight: "700" },
  disabled: { opacity: 0.5 },
})
