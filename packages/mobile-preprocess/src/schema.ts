export const CLIENT_PREPROCESS_VERSION = 1 as const

export type TimeInterval = {
  start: number
  end: number
}

export type ClientPreprocessQc = {
  blur: number
  shake: number
  darkness: number
  subjectVisibleRatio: number
  jerseyVisibleRatio: number
  passed: boolean
}

export type ClientPreprocessTranscode = {
  codec: string
  width: number
  height: number
  fps: number
  bitrateKbps: number
}

export type ClientPreprocessCapture = {
  arenaId?: string | null
  gps?: { lat: number; lng: number } | null
  eventKind?: string | null
  jerseyColor?: string | null
  jerseyNumber?: string | null
  captureRole?: string | null
}

export type ClientPreprocessSidecar = {
  preprocessVersion: typeof CLIENT_PREPROCESS_VERSION
  sourceDurationSeconds: number
  outputDurationSeconds: number
  deadAirIntervals: TimeInterval[]
  activeCoverage: number
  qc: ClientPreprocessQc
  transcode: ClientPreprocessTranscode
  capture?: ClientPreprocessCapture
}

export type QcThresholds = {
  minSubjectVisibleRatio: number
  minJerseyVisibleRatio: number
  maxBlur: number
  maxShake: number
  maxDarkness: number
}

export const DEFAULT_QC_THRESHOLDS: QcThresholds = {
  minSubjectVisibleRatio: 0.5,
  minJerseyVisibleRatio: 0.4,
  maxBlur: 0.65,
  maxShake: 0.7,
  maxDarkness: 0.75,
}

export type QcFailureReason =
  | "subject_not_visible"
  | "jersey_not_visible"
  | "too_blurry"
  | "too_shaky"
  | "too_dark"

export type ValidateSidecarResult =
  | { ok: true; sidecar: ClientPreprocessSidecar }
  | { ok: false; error: string }

export function validateClientPreprocessSidecar(raw: unknown): ValidateSidecarResult {
  if (raw == null || typeof raw !== "object") {
    return { ok: false, error: "Sidecar must be an object" }
  }
  const o = raw as Record<string, unknown>
  if (o.preprocessVersion !== CLIENT_PREPROCESS_VERSION) {
    return { ok: false, error: "Unsupported preprocessVersion" }
  }
  const sourceDurationSeconds = numInRange(o.sourceDurationSeconds, 1, 8 * 60 * 60)
  const outputDurationSeconds = numInRange(o.outputDurationSeconds, 1, 8 * 60 * 60)
  if (sourceDurationSeconds == null || outputDurationSeconds == null) {
    return { ok: false, error: "Invalid duration fields" }
  }
  if (outputDurationSeconds > sourceDurationSeconds) {
    return { ok: false, error: "outputDurationSeconds cannot exceed sourceDurationSeconds" }
  }
  const deadAirIntervals = parseIntervals(o.deadAirIntervals, sourceDurationSeconds)
  if (deadAirIntervals == null) {
    return { ok: false, error: "Invalid deadAirIntervals" }
  }
  const activeCoverage = numInRange(o.activeCoverage, 0, 1)
  if (activeCoverage == null) {
    return { ok: false, error: "Invalid activeCoverage" }
  }
  const qcParsed = parseQc(o.qc)
  if (!qcParsed.ok) return qcParsed
  const transcodeParsed = parseTranscode(o.transcode)
  if (!transcodeParsed.ok) return transcodeParsed
  const capture = parseCapture(o.capture)

  return {
    ok: true,
    sidecar: {
      preprocessVersion: CLIENT_PREPROCESS_VERSION,
      sourceDurationSeconds,
      outputDurationSeconds,
      deadAirIntervals,
      activeCoverage,
      qc: qcParsed.qc,
      transcode: transcodeParsed.transcode,
      ...(capture ? { capture } : {}),
    },
  }
}

function numInRange(v: unknown, min: number, max: number): number | null {
  const n = Number(v)
  if (!Number.isFinite(n) || n < min || n > max) return null
  return n
}

function parseIntervals(raw: unknown, maxDuration: number): TimeInterval[] | null {
  if (!Array.isArray(raw)) return null
  const out: TimeInterval[] = []
  for (const item of raw) {
    if (item == null || typeof item !== "object") return null
    const start = numInRange((item as Record<string, unknown>).start, 0, maxDuration)
    const end = numInRange((item as Record<string, unknown>).end, 0, maxDuration)
    if (start == null || end == null || end <= start) return null
    out.push({ start, end })
  }
  out.sort((a, b) => a.start - b.start)
  for (let i = 1; i < out.length; i++) {
    if (out[i].start < out[i - 1].end) return null
  }
  return out
}

function parseQc(raw: unknown): { ok: true; qc: ClientPreprocessQc } | { ok: false; error: string } {
  if (raw == null || typeof raw !== "object") return { ok: false, error: "Invalid qc" }
  const o = raw as Record<string, unknown>
  const blur = numInRange(o.blur, 0, 1)
  const shake = numInRange(o.shake, 0, 1)
  const darkness = numInRange(o.darkness, 0, 1)
  const subjectVisibleRatio = numInRange(o.subjectVisibleRatio, 0, 1)
  const jerseyVisibleRatio = numInRange(o.jerseyVisibleRatio, 0, 1)
  if (
    blur == null ||
    shake == null ||
    darkness == null ||
    subjectVisibleRatio == null ||
    jerseyVisibleRatio == null
  ) {
    return { ok: false, error: "Invalid qc metrics" }
  }
  if (typeof o.passed !== "boolean") return { ok: false, error: "qc.passed must be boolean" }
  return {
    ok: true,
    qc: { blur, shake, darkness, subjectVisibleRatio, jerseyVisibleRatio, passed: o.passed },
  }
}

function parseTranscode(
  raw: unknown,
): { ok: true; transcode: ClientPreprocessTranscode } | { ok: false; error: string } {
  if (raw == null || typeof raw !== "object") return { ok: false, error: "Invalid transcode" }
  const o = raw as Record<string, unknown>
  const codec = typeof o.codec === "string" ? o.codec.trim() : ""
  const width = numInRange(o.width, 1, 7680)
  const height = numInRange(o.height, 1, 4320)
  const fps = numInRange(o.fps, 1, 120)
  const bitrateKbps = numInRange(o.bitrateKbps, 64, 50_000)
  if (!codec || width == null || height == null || fps == null || bitrateKbps == null) {
    return { ok: false, error: "Invalid transcode profile" }
  }
  return { ok: true, transcode: { codec, width, height, fps, bitrateKbps } }
}

function parseCapture(raw: unknown): ClientPreprocessCapture | undefined {
  if (raw == null || typeof raw !== "object") return undefined
  const o = raw as Record<string, unknown>
  const capture: ClientPreprocessCapture = {}
  if (typeof o.arenaId === "string" && o.arenaId.trim()) capture.arenaId = o.arenaId.trim()
  if (o.gps != null && typeof o.gps === "object") {
    const g = o.gps as Record<string, unknown>
    const lat = Number(g.lat)
    const lng = Number(g.lng)
    if (Number.isFinite(lat) && Number.isFinite(lng)) capture.gps = { lat, lng }
  }
  if (typeof o.eventKind === "string") capture.eventKind = o.eventKind.trim() || null
  if (typeof o.jerseyColor === "string") capture.jerseyColor = o.jerseyColor.trim() || null
  if (typeof o.jerseyNumber === "string") capture.jerseyNumber = o.jerseyNumber.trim().slice(0, 8) || null
  if (typeof o.captureRole === "string") capture.captureRole = o.captureRole.trim() || null
  return Object.keys(capture).length > 0 ? capture : undefined
}
