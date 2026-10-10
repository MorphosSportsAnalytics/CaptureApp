import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
import { useSyncExternalStore } from "react"
import { useI18n } from "@/i18n/I18nProvider"
import { bootPhaseLabel, getBootLogSnapshot, subscribeBootLog } from "@/diagnostics/bootLog"

/** Dark full-screen placeholder while auth/session bootstrap runs. */
export function AppBootScreen() {
  const { messages } = useI18n()
  const snapshot = useSyncExternalStore(subscribeBootLog, getBootLogSnapshot)
  return (
    <View style={styles.root}>
      <ActivityIndicator color="#38bdf8" size="large" />
      <Text style={styles.status}>{messages.diagnostics.stillStarting}</Text>
      <Text style={styles.phase}>{bootPhaseLabel(messages, snapshot.phase)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  status: { color: "#f8fafc", fontSize: 16, fontWeight: "700", marginTop: 20, textAlign: "center" },
  phase: { color: "#94a3b8", fontSize: 14, marginTop: 8, textAlign: "center" },
})
