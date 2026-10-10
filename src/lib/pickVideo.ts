import { launchImageLibrary, type Asset } from "react-native-image-picker"

export type PickedVideo = {
  uri: string
  fileName?: string | null
  duration?: number | null
  fileSize?: number | null
  exif?: Record<string, unknown> | null
}

export async function pickVideoFromLibrary(): Promise<PickedVideo | null> {
  const result = await launchImageLibrary({
    mediaType: "video",
    selectionLimit: 1,
    assetRepresentationMode: "current",
  })
  if (result.didCancel || !result.assets?.[0]) return null
  return toPickedVideo(result.assets[0])
}

export function toPickedVideo(asset: Asset): PickedVideo {
  return {
    uri: asset.uri ?? "",
    fileName: asset.fileName,
    duration: asset.duration,
    fileSize: asset.fileSize,
    exif: null,
  }
}
