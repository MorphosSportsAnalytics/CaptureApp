import { View, Text, StyleSheet } from "react-native"

export function CaptureOverlay({ horizonHint }: { horizonHint?: string }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.topGuide} />
      <View style={styles.bottomGuide} />
      <View style={styles.centerBox} />
      {horizonHint ? <Text style={styles.hint}>{horizonHint}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  topGuide: {
    position: "absolute",
    top: "18%",
    left: "8%",
    right: "8%",
    height: 2,
    backgroundColor: "rgba(56, 189, 248, 0.7)",
  },
  bottomGuide: {
    position: "absolute",
    bottom: "22%",
    left: "8%",
    right: "8%",
    height: 2,
    backgroundColor: "rgba(56, 189, 248, 0.7)",
  },
  centerBox: {
    position: "absolute",
    top: "18%",
    bottom: "22%",
    left: "8%",
    right: "8%",
    borderWidth: 2,
    borderColor: "rgba(148, 163, 184, 0.5)",
    borderRadius: 8,
  },
  hint: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    color: "#e2e8f0",
    fontSize: 12,
  },
})
