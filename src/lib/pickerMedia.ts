/** react-native-image-picker reports video duration in seconds. */
export function pickerDurationSeconds(durationSeconds: number | null | undefined): number {
  if (durationSeconds == null || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0
  return durationSeconds
}

export function pickerRecordedAtMs(asset: {
  exif?: Record<string, unknown> | null
}): number {
  const raw = asset.exif?.DateTimeOriginal ?? asset.exif?.DateTime
  if (typeof raw === "string") {
    const parsed = Date.parse(raw.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3"))
    if (Number.isFinite(parsed)) return parsed
  }
  if (typeof raw === "number" && Number.isFinite(raw)) return raw
  return Date.now()
}
