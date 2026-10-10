import { Modal, View, Text, Pressable, StyleSheet } from "react-native"
import { qcFailureMessage } from "@morphos/mobile-i18n"
import { useI18n } from "@/i18n/I18nProvider"

type Props = {
  visible: boolean
  failures: string[]
  overrideChecked: boolean
  onToggleOverride: (v: boolean) => void
  onRetry: () => void
  onContinue: () => void
}

export function QcGateModal({
  visible,
  failures,
  overrideChecked,
  onToggleOverride,
  onRetry,
  onContinue,
}: Props) {
  const { messages } = useI18n()
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{messages.qc.failedTitle}</Text>
          {failures.map((f) => (
            <Text key={f} style={styles.body}>
              • {qcFailureMessage(messages, f)}
            </Text>
          ))}
          <Pressable style={styles.checkRow} onPress={() => onToggleOverride(!overrideChecked)}>
            <Text style={styles.body}>{overrideChecked ? "☑" : "☐"} {messages.qc.overrideAck}</Text>
          </Pressable>
          <View style={styles.actions}>
            <Pressable style={styles.btnSecondary} onPress={onRetry}>
              <Text style={styles.btnText}>{messages.qc.retry}</Text>
            </Pressable>
            <Pressable
              style={[styles.btnPrimary, !overrideChecked && failures.length > 0 && styles.btnDisabled]}
              onPress={onContinue}
              disabled={!overrideChecked && failures.length > 0}
            >
              <Text style={styles.btnText}>{messages.upload.title}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  title: { color: "#f8fafc", fontSize: 18, fontWeight: "700" },
  body: { color: "#cbd5e1", fontSize: 14 },
  checkRow: { marginTop: 8 },
  actions: { flexDirection: "row", gap: 12, marginTop: 12 },
  btnPrimary: {
    flex: 1,
    backgroundColor: "#0284c7",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: "#334155",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "600" },
})
