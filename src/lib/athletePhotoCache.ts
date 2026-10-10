import type { AthletePhotoKind, PortalApiClientConfig } from "@morphos/portal-api-client"
import { athletePhotoRequest } from "@morphos/portal-api-client"
import { cacheDirectoryUri, deletePath, downloadToFile, ensureDir, pathExists } from "./deviceFile"

const PHOTO_CACHE_DIR = `${cacheDirectoryUri()}athlete-photos`

function cacheFileName(
  athleteId: string,
  kind: AthletePhotoKind,
  updatedAt?: string | number | Date | null,
): string {
  const v =
    updatedAt == null
      ? "0"
      : String(
          updatedAt instanceof Date
            ? updatedAt.getTime()
            : new Date(updatedAt).getTime() || 0,
        )
  return `${athleteId.trim()}-${kind}-${v}.jpg`
}

/**
 * Downloads an authenticated athlete photo to the app cache and returns a local file URI.
 * React Native's default Image component does not reliably send Authorization headers on Android.
 */
export async function loadCachedAthletePhotoUri(
  cfg: PortalApiClientConfig,
  athleteId: string,
  kind: AthletePhotoKind,
  updatedAt?: string | number | Date | null,
): Promise<string | null> {
  const id = athleteId.trim()
  if (!id || !PHOTO_CACHE_DIR) return null

  const fileName = cacheFileName(id, kind, updatedAt)
  const dest = `${PHOTO_CACHE_DIR}/${fileName}`
  if (await pathExists(dest)) return dest

  await ensureDir(PHOTO_CACHE_DIR).catch(() => {})

  const { uri, headers } = athletePhotoRequest(cfg, id, kind, updatedAt)
  const result = await downloadToFile(uri, dest, headers)
  if (result.status !== 200) {
    await deletePath(dest)
    return null
  }
  return result.uri
}
