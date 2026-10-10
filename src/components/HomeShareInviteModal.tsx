import { useMemo } from "react"
import {
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from "react-native"
import Ionicons from "react-native-vector-icons/Ionicons"
import type { MyShareInviteResponse } from "@morphos/portal-api-client"
import { primaryShareInviteQrUrl } from "@morphos/portal-api-client"
import type { MobileMessages } from "@morphos/mobile-i18n"
import { QrCodeView } from "@/components/QrCodeView"

type Props = {
  visible: boolean
  onClose: () => void
  data: MyShareInviteResponse | null
  portalWebUrl: string
  messages: MobileMessages
  loading?: boolean
  loadError?: boolean
  onRetry?: () => void
}

function referralStatusLabel(status: string, messages: MobileMessages): string {
  return status === "active" ? messages.home.referralActive : messages.home.referralInactive
}

export function HomeShareInviteModal({
  visible,
  onClose,
  data,
  portalWebUrl,
  messages,
  loading = false,
  loadError = false,
  onRetry,
}: Props) {
  const primaryUrl = useMemo(
    () => (data ? primaryShareInviteQrUrl(data, portalWebUrl) : null),
    [data, portalWebUrl],
  )

  const primaryCode = data?.peerInvite?.code ?? data?.referralCodes[0]?.code ?? null

  const sharePrimary = async () => {
    if (!primaryUrl) return
    const message = primaryCode ? `${primaryUrl}\n${primaryCode}` : primaryUrl
    await Share.share({ message, url: primaryUrl })
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{messages.home.shareInviteTitle}</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={messages.home.shareInviteClose}
              hitSlop={8}
            >
              <Ionicons name="close" size={24} color="#94a3b8" />
            </Pressable>
          </View>

          <Text style={styles.body}>{messages.home.shareInviteBody}</Text>

          {loading ? (
            <View style={styles.qrWrap}>
              <ActivityIndicator color="#38bdf8" />
            </View>
          ) : loadError ? (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>{messages.home.shareInviteLoadFailed}</Text>
              {onRetry ? (
                <Pressable style={styles.retryBtn} onPress={onRetry} accessibilityRole="button">
                  <Text style={styles.retryBtnText}>{messages.home.shareInvite}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {!loading && !loadError && primaryUrl ? (
            <View style={styles.qrWrap}>
              <QrCodeView value={primaryUrl} size={256} />
            </View>
          ) : null}

          {!loading && !loadError && data?.peerInvite ? (
            <View style={styles.codeBlock}>
              <Text style={styles.codeLabel}>{messages.home.peerInviteLabel}</Text>
              <Text style={styles.codeValue}>{data.peerInvite.code}</Text>
            </View>
          ) : null}

          {!loading && !loadError && data && data.referralCodes.length > 0 ? (
            <View style={styles.referralList}>
              <Text style={styles.sectionLabel}>{messages.home.referralCodeLabel}</Text>
              {data.referralCodes.map((row) => (
                <View key={row.code} style={styles.referralRow}>
                  <View style={styles.referralMain}>
                    <Text style={styles.codeValue}>{row.code}</Text>
                    {row.label ? <Text style={styles.referralHint}>{row.label}</Text> : null}
                  </View>
                  <Text style={styles.referralStatus}>{referralStatusLabel(row.status, messages)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {!loading && !loadError && primaryUrl ? (
            <Pressable style={styles.shareBtn} onPress={() => void sharePrimary()} accessibilityRole="button">
              <Ionicons name="share-outline" size={18} color="#fff" />
              <Text style={styles.shareBtnText}>{messages.home.shareInvite}</Text>
            </Pressable>
          ) : null}

          <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.closeBtnText}>{messages.home.shareInviteClose}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.72)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderColor: "#334155",
    borderWidth: 1,
    padding: 20,
    gap: 14,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { color: "#f8fafc", fontSize: 18, fontWeight: "700", flex: 1, paddingRight: 8 },
  body: { color: "#94a3b8", fontSize: 14, lineHeight: 20 },
  qrWrap: {
    alignSelf: "center",
    width: 256,
    height: 256,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  errorWrap: { gap: 10, alignItems: "center", paddingVertical: 8 },
  errorText: { color: "#fca5a5", fontSize: 14, textAlign: "center", lineHeight: 20 },
  retryBtn: {
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#1e293b",
  },
  retryBtnText: { color: "#38bdf8", fontWeight: "600", fontSize: 14 },
  codeBlock: { gap: 4 },
  codeLabel: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  codeValue: {
    color: "#f8fafc",
    fontFamily: "monospace",
    fontSize: 16,
    fontWeight: "600",
  },
  sectionLabel: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  referralList: { gap: 8 },
  referralRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#1e293b",
  },
  referralMain: { flex: 1, gap: 2, minWidth: 0 },
  referralHint: { color: "#94a3b8", fontSize: 12 },
  referralStatus: { color: "#94a3b8", fontSize: 12, fontWeight: "600" },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0284c7",
    borderRadius: 10,
    paddingVertical: 14,
  },
  shareBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  closeBtn: { alignItems: "center", paddingVertical: 8 },
  closeBtnText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
})
