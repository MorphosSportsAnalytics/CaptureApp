import {
  activeCoverage,
  buildQcMetrics,
  evaluateQc,
  planTranscode,
  type ClientPreprocessSidecar,
  type SourceVideoProbe,
} from "@morphos/mobile-preprocess"
import { sampleQcFromVideo } from "./qcSampler"

export const VIDEO_TOO_LONG = "VIDEO_TOO_LONG"

export type TranscodeEncodeInput = {
  inputUri: string
  outputUri: string
  width: number
  height: number
  fps: number
  bitrateKbps: number
  onProgress?: (progress: number) => void
  signal?: AbortSignal
}

export type VideoTranscoder = {
  probe: (uri: string) => Promise<SourceVideoProbe>
  encode: (input: TranscodeEncodeInput) => Promise<{ outputUri: string }>
  createOutputUri: () => string
}

export type PreprocessInput = {
  inputUri: string
  sourceDurationSeconds: number
  maxDurationSeconds: number
  skillClipMode?: boolean
  capture?: ClientPreprocessSidecar["capture"]
  transcode?: VideoTranscoder
  onProgress?: (progress: number) => void
  signal?: AbortSignal
}

export type PreprocessResult =
  | { ok: true; outputUri: string; sidecar: ClientPreprocessSidecar; qcPassed: boolean; qcFailures: string[] }
  | { ok: false; error: string; code?: typeof VIDEO_TOO_LONG }

export async function runPreprocessPipeline(input: PreprocessInput): Promise<PreprocessResult> {
  try {
    const sourceDuration = input.sourceDurationSeconds
    if (!Number.isFinite(sourceDuration) || sourceDuration <= 0) {
      return { ok: false, error: "Could not read video duration." }
    }
    if (sourceDuration > input.maxDurationSeconds) {
      return { ok: false, error: "This clip exceeds your plan's maximum length.", code: VIDEO_TOO_LONG }
    }

    const sourceQc = await sampleQcFromVideo(input.inputUri, sourceDuration)
    const coverage = activeCoverage([], sourceDuration)
    const evaluation = evaluateQc(sourceQc)
    const qc = buildQcMetrics(sourceQc)

    const transcodeRuntime = input.transcode
    if (!transcodeRuntime) {
      return { ok: false, error: "Video preparation is unavailable on this device." }
    }

    const probe = await transcodeRuntime.probe(input.inputUri)
    const plan = planTranscode(probe, { skillClipMode: input.skillClipMode === true })
    let outputUri = input.inputUri
    let transcode = plan.output

    if (plan.action === "encode") {
      if (input.signal?.aborted) {
        return { ok: false, error: "cancelled" }
      }
      const encoded = await transcodeRuntime.encode({
        inputUri: input.inputUri,
        outputUri: transcodeRuntime.createOutputUri(),
        width: plan.output.width,
        height: plan.output.height,
        fps: plan.output.fps,
        bitrateKbps: plan.output.bitrateKbps,
        onProgress: input.onProgress,
        signal: input.signal,
      })
      outputUri = encoded.outputUri
      try {
        const actual = await transcodeRuntime.probe(outputUri)
        transcode = {
          codec: actual.codec.trim() ? actual.codec : plan.output.codec,
          width: actual.width > 0 ? actual.width : plan.output.width,
          height: actual.height > 0 ? actual.height : plan.output.height,
          fps: actual.fps > 0 ? Math.round(actual.fps) : plan.output.fps,
          bitrateKbps: actual.bitrateKbps > 0 ? Math.round(actual.bitrateKbps) : plan.output.bitrateKbps,
        }
      } catch {
        transcode = plan.output
      }
    }

    const sidecar: ClientPreprocessSidecar = {
      preprocessVersion: 1,
      sourceDurationSeconds: sourceDuration,
      outputDurationSeconds: sourceDuration,
      deadAirIntervals: [],
      activeCoverage: coverage,
      qc,
      transcode,
      ...(input.capture ? { capture: input.capture } : {}),
    }

    return {
      ok: true,
      outputUri,
      sidecar,
      qcPassed: evaluation.passed,
      qcFailures: evaluation.failures,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Preprocess failed"
    if (message === "cancelled") return { ok: false, error: "cancelled" }
    return { ok: false, error: message }
  }
}
