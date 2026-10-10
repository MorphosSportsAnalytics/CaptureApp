import { NativeEventEmitter, NativeModules } from "react-native"
import { cacheDirectoryUri } from "@/lib/deviceFile"
import { createDeviceTranscoder } from "./transcodeDevice"
import type { VideoTranscoder } from "./pipeline"

type NativeTranscode = {
  probe: (uri: string) => Promise<{
    width: number
    height: number
    fps: number
    bitrateKbps: number
    codec: string
  }>
  encode: (options: {
    inputUri: string
    outputUri: string
    width: number
    height: number
    fps: number
    bitrateKbps: number
  }) => Promise<{ outputUri: string }>
  cancel: () => void
}

export function loadDeviceTranscoder(): VideoTranscoder {
  const native = NativeModules.MorphosVideoTranscode as NativeTranscode | undefined
  if (!native) {
    throw new Error("MorphosVideoTranscode native module is missing. Rebuild the app.")
  }
  const emitter = new NativeEventEmitter(native as never)
  return createDeviceTranscoder(
    {
      probe: (uri: string) => native.probe(uri),
      encode: (options) => native.encode(options),
      cancel: () => native.cancel(),
      addListener: (event, listener) => {
        const sub = emitter.addListener(event, listener)
        return { remove: () => sub.remove() }
      },
    },
    { cacheDirectory: cacheDirectoryUri() },
  )
}
