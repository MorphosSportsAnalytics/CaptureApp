import ReactNativeBlobUtil from "react-native-blob-util"

function toPath(uri: string): string {
  return uri.startsWith("file://") ? uri.replace(/^file:\/\//, "") : uri
}

export function cacheDirectoryUri(): string {
  const dir = ReactNativeBlobUtil.fs.dirs.CacheDir.replace(/\/?$/, "/")
  return dir.startsWith("file:") ? dir : `file://${dir}`
}

export async function pathExists(uri: string): Promise<boolean> {
  try {
    return await ReactNativeBlobUtil.fs.exists(toPath(uri))
  } catch {
    return false
  }
}

export async function ensureDir(uri: string): Promise<void> {
  const path = toPath(uri)
  const exists = await ReactNativeBlobUtil.fs.exists(path)
  if (exists) return
  await ReactNativeBlobUtil.fs.mkdir(path)
}

export async function deletePath(uri: string): Promise<void> {
  const path = toPath(uri)
  try {
    const exists = await ReactNativeBlobUtil.fs.exists(path)
    if (exists) await ReactNativeBlobUtil.fs.unlink(path)
  } catch {
    // Best-effort cleanup.
  }
}

export async function downloadToFile(
  url: string,
  destUri: string,
  headers?: Record<string, string>,
): Promise<{ status: number; uri: string }> {
  const dest = toPath(destUri)
  const result = await ReactNativeBlobUtil.config({ path: dest, fileCache: true }).fetch("GET", url, headers)
  const status = result.info().status
  return { status, uri: dest.startsWith("/") ? `file://${dest}` : dest }
}

export async function uploadBinary(url: string, fileUri: string, headers?: Record<string, string>): Promise<number> {
  const result = await ReactNativeBlobUtil.fetch(
    "PUT",
    url,
    { ...headers, "Content-Type": headers?.["Content-Type"] ?? "application/octet-stream" },
    ReactNativeBlobUtil.wrap(toPath(fileUri)),
  )
  return result.info().status
}
