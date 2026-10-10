import { useMemo } from "react"
import { View, StyleSheet } from "react-native"
import { buildQrMatrix } from "./qrCodeMatrix"

type Props = {
  value: string
  size?: number
  darkColor?: string
  lightColor?: string
}

export function QrCodeView({
  value,
  size = 256,
  darkColor = "#0f172a",
  lightColor = "#ffffff",
}: Props) {
  const matrix = useMemo(() => buildQrMatrix(value), [value])
  const cellSize = size / matrix.size

  return (
    <View
      style={[styles.root, { width: size, height: size, backgroundColor: lightColor }]}
      accessibilityIgnoresInvertColors
    >
      {Array.from({ length: matrix.size }, (_, row) => (
        <View key={row} style={[styles.row, { height: cellSize }]}>
          {Array.from({ length: matrix.size }, (_, col) => {
            const dark = matrix.cells[row * matrix.size + col] === true
            return (
              <View
                key={col}
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: dark ? darkColor : lightColor,
                }}
              />
            )
          })}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { overflow: "hidden" },
  row: { flexDirection: "row" },
})
