import { Image, Pressable, StyleSheet } from "react-native"

const LOGO = require("../../assets/splash-icon.png")

type Props = {
  accessibilityLabel: string
  onPress: () => void
}

export function HomeHeaderLogo({ accessibilityLabel, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={styles.wrap}
      hitSlop={8}
    >
      <Image source={LOGO} style={styles.logo} accessibilityIgnoresInvertColors />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: { marginLeft: 12, padding: 2 },
  logo: { width: 28, height: 28, borderRadius: 6 },
})
