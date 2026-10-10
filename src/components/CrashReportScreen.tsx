import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import type { MobileMessages } from "@morphos/mobile-i18n"
import {
  bootPhaseLabel,
  diagnosticMessages,
  formatUnknownError,
  type BootPhase,
} from "@/diagnostics/bootLog"

type CrashReportScreenProps = {
  error: unknown
  onRetry: () => void
  phase?: BootPhase
  componentStack?: string
  messages?: MobileMessages
}

export function CrashReportScreen({
  error,
  onRetry,
  phase = "jsStarted",
  componentStack = "",
  messages = diagnosticMessages("en-CA"),
}: CrashReportScreenProps) {
  const formatted = formatUnknownError(error)
  const details = [formatted.stack, componentStack].filter((part) => part.trim()).join("\n")
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{messages.diagnostics.title}</Text>
      <Text style={styles.body}>{messages.diagnostics.body}</Text>
      <Text style={styles.label}>{messages.diagnostics.phaseLabel}</Text>
      <Text selectable style={styles.value}>
        {bootPhaseLabel(messages, phase)}
      </Text>
      <Text style={styles.label}>{messages.diagnostics.errorLabel}</Text>
      <ScrollView style={styles.details} contentContainerStyle={styles.detailsContent}>
        <Text selectable style={styles.value}>
          {formatted.message}
        </Text>
        {details ? (
          <Text selectable style={styles.stack}>
            {details}
          </Text>
        ) : null}
      </ScrollView>
      <Pressable style={styles.retry} onPress={onRetry} accessibilityRole="button">
        <Text style={styles.retryText}>{messages.diagnostics.retry}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#020617",
    padding: 24,
    paddingTop: 64,
  },
  title: { color: "#f8fafc", fontSize: 24, fontWeight: "800", marginBottom: 12 },
  body: { color: "#94a3b8", fontSize: 15, marginBottom: 20 },
  label: { color: "#38bdf8", fontSize: 13, fontWeight: "700", marginTop: 12, marginBottom: 4 },
  value: { color: "#f8fafc", fontSize: 15 },
  stack: { color: "#cbd5e1", fontSize: 12, marginTop: 12 },
  details: { flexGrow: 1, flexShrink: 1, marginBottom: 16 },
  detailsContent: { paddingBottom: 12 },
  retry: {
    backgroundColor: "#0284c7",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
})
