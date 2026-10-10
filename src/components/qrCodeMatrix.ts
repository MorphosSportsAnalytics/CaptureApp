import QRCode from "qrcode"

export type QrMatrix = {
  size: number
  cells: readonly boolean[]
}

/** Build a QR module grid for React Native (no Canvas required). */
export function buildQrMatrix(text: string, marginModules = 2): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" })
  const moduleSize = qr.modules.size
  const total = moduleSize + marginModules * 2
  const cells: boolean[] = new Array(total * total).fill(false)
  for (let y = 0; y < total; y++) {
    for (let x = 0; x < total; x++) {
      const mx = x - marginModules
      const my = y - marginModules
      if (mx >= 0 && mx < moduleSize && my >= 0 && my < moduleSize) {
        cells[y * total + x] = qr.modules.get(my, mx) === 1
      }
    }
  }
  return { size: total, cells }
}
