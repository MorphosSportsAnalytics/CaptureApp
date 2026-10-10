import type { ClientPreprocessTranscode } from "./schema.js"

export const RECOMMENDED_OUTPUT_PROFILE = {
  codec: "h264",
  width: 1920,
  height: 1080,
  fps: 30,
  bitrateKbps: 5000,
} as const

export const SKILL_CLIP_MAX_FPS = 60
export const OUTPUT_LONG_EDGE = 1920
export const OUTPUT_SHORT_EDGE = 1080

export type SourceVideoProbe = {
  width: number
  height: number
  fps: number
  bitrateKbps: number
  codec: string
}

export type TranscodePlan = {
  action: "skip" | "encode"
  output: ClientPreprocessTranscode
}

export function maxOutputFps(skillClipMode: boolean): number {
  return skillClipMode ? SKILL_CLIP_MAX_FPS : RECOMMENDED_OUTPUT_PROFILE.fps
}

export function evenDimension(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 2
  const rounded = Math.max(2, Math.round(n))
  return rounded - (rounded % 2)
}

export function capOutputSize(width: number, height: number): { width: number; height: number } {
  const w = Number.isFinite(width) && width > 0 ? width : RECOMMENDED_OUTPUT_PROFILE.width
  const h = Number.isFinite(height) && height > 0 ? height : RECOMMENDED_OUTPUT_PROFILE.height
  const longEdge = Math.max(w, h)
  const shortEdge = Math.min(w, h)
  const scale = Math.min(1, OUTPUT_LONG_EDGE / longEdge, OUTPUT_SHORT_EDGE / shortEdge)
  return {
    width: evenDimension(w * scale),
    height: evenDimension(h * scale),
  }
}

export function isH264Codec(codec: string): boolean {
  const c = codec.trim().toLowerCase()
  if (!c) return true
  if (c.includes("hevc") || c.includes("hvc1") || c.includes("hev1") || c.includes("h265")) return false
  return c === "h264" || c === "avc" || c === "avc1" || c.includes("avc") || c.includes("h264")
}

export function planTranscode(source: SourceVideoProbe, opts: { skillClipMode: boolean }): TranscodePlan {
  const maxFps = maxOutputFps(opts.skillClipMode)
  const size = capOutputSize(source.width, source.height)
  const sourceFps = Number.isFinite(source.fps) && source.fps > 0 ? source.fps : RECOMMENDED_OUTPUT_PROFILE.fps
  const fps = Math.min(Math.max(1, Math.round(sourceFps)), maxFps)
  const sourceBitrate =
    Number.isFinite(source.bitrateKbps) && source.bitrateKbps > 0
      ? source.bitrateKbps
      : RECOMMENDED_OUTPUT_PROFILE.bitrateKbps
  const bitrateKbps = Math.min(Math.round(sourceBitrate), RECOMMENDED_OUTPUT_PROFILE.bitrateKbps)
  const output: ClientPreprocessTranscode = {
    codec: RECOMMENDED_OUTPUT_PROFILE.codec,
    width: size.width,
    height: size.height,
    fps,
    bitrateKbps,
  }

  const scale = Math.min(
    1,
    OUTPUT_LONG_EDGE / Math.max(source.width, source.height, 1),
    OUTPUT_SHORT_EDGE / Math.min(source.width, source.height, 1),
  )
  const withinSize = scale >= 1
  const withinFps = sourceFps <= maxFps + 0.51
  const withinBitrate = !(source.bitrateKbps > RECOMMENDED_OUTPUT_PROFILE.bitrateKbps)
  const skip = isH264Codec(source.codec) && withinSize && withinFps && withinBitrate

  return { action: skip ? "skip" : "encode", output }
}
