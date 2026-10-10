import { NativeEventEmitter, NativeModules, Platform } from "react-native"

type ProbeResult = {
  width: number
  height: number
  fps: number
  bitrateKbps: number
  codec: string
}

type EncodeOptions = {
  inputUri: string
  outputUri: string
  width: number
  height: number
  fps: number
  bitrateKbps: number
}

type EncodeResult = {
  outputUri: string
}

type NativeTranscode = {
  probe: (uri: string) => Promise<ProbeResult>
  encode: (options: EncodeOptions) => Promise<EncodeResult>
  cancel: () => void
}

const native = NativeModules.MorphosVideoTranscode as NativeTranscode | undefined

function requireNative(): NativeTranscode {
  if (!native) {
    const hint =
      Platform.OS === "ios"
        ? "Rebuild the iOS app after linking morphos-video-transcode."
        : "Rebuild the Android app after linking morphos-video-transcode."
    throw new Error(`MorphosVideoTranscode native module is missing. ${hint}`)
  }
  return native
}

export function probe(uri: string): Promise<ProbeResult> {
  return requireNative().probe(uri)
}

export function encode(options: EncodeOptions): Promise<EncodeResult> {
  return requireNative().encode(options)
}

export function cancel(): void {
  requireNative().cancel()
}

export function addListener(
  event: "onProgress",
  listener: (payload: { progress: number }) => void,
): { remove: () => void } {
  const emitter = new NativeEventEmitter(
    requireNative() as unknown as ConstructorParameters<typeof NativeEventEmitter>[0],
  )
  const sub = emitter.addListener(event, listener)
  return { remove: () => sub.remove() }
}

export default native
