import type { SourceVideoProbe } from "@morphos/mobile-preprocess"
import type { TranscodeEncodeInput, VideoTranscoder } from "./pipeline"

export type NativeTranscodeModule = {
  probe: (uri: string) => Promise<SourceVideoProbe>
  encode: (options: {
    inputUri: string
    outputUri: string
    width: number
    height: number
    fps: number
    bitrateKbps: number
  }) => Promise<{ outputUri: string }>
  cancel: () => void
  addListener: (event: "onProgress", listener: (event: { progress: number }) => void) => { remove: () => void }
}

export function createDeviceTranscoder(
  native: NativeTranscodeModule,
  io: { cacheDirectory: string | null },
): VideoTranscoder {
  return {
    probe: (uri) => native.probe(uri),
    createOutputUri: () => {
      const dir = io.cacheDirectory?.replace(/\/?$/, "/") ?? "file:///"
      return `${dir}morphos-transcode-${Date.now()}.mp4`
    },
    encode: async (input: TranscodeEncodeInput) => {
      const onAbort = () => native.cancel()
      if (input.signal?.aborted) {
        throw new Error("cancelled")
      }
      input.signal?.addEventListener("abort", onAbort)
      const sub = native.addListener("onProgress", (event) => {
        const p = Number(event?.progress)
        if (Number.isFinite(p)) input.onProgress?.(Math.max(0, Math.min(1, p)))
      })
      try {
        const result = await native.encode({
          inputUri: input.inputUri,
          outputUri: input.outputUri,
          width: input.width,
          height: input.height,
          fps: input.fps,
          bitrateKbps: input.bitrateKbps,
        })
        if (input.signal?.aborted) throw new Error("cancelled")
        return { outputUri: result.outputUri }
      } catch (err) {
        if (input.signal?.aborted) throw new Error("cancelled")
        throw err instanceof Error ? err : new Error("Couldn't prepare this video for upload.")
      } finally {
        input.signal?.removeEventListener("abort", onAbort)
        sub.remove()
      }
    },
  }
}
