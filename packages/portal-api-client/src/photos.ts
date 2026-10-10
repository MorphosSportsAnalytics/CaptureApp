import type { PortalApiClientConfig } from "./fetch.js"
import { portalAuthHeaders } from "./fetch.js"

export type AthletePhotoKind = "mugshot" | "action_shot"

export type AthletePhotoRequest = {
  uri: string
  headers: Record<string, string>
}

function photoCacheBustQuery(updatedAt?: string | number | Date | null): string {
  if (updatedAt == null) return ""
  const ms = updatedAt instanceof Date ? updatedAt.getTime() : new Date(updatedAt).getTime()
  if (!Number.isFinite(ms)) return ""
  return `?v=${Math.floor(ms)}`
}

/** Authenticated image source for React Native `<Image source={…} />`. */
export function athletePhotoRequest(
  cfg: PortalApiClientConfig,
  athleteId: string,
  kind: AthletePhotoKind,
  updatedAt?: string | number | Date | null,
): AthletePhotoRequest {
  const id = athleteId.trim()
  const base = cfg.baseUrl.replace(/\/$/, "")
  const v = photoCacheBustQuery(updatedAt)
  return {
    uri: `${base}/v1/portal/athletes/${encodeURIComponent(id)}/photos/${kind}${v}`,
    headers: portalAuthHeaders(cfg.bearerToken),
  }
}

export function athleteAvatarPhotoKind(args: {
  hasActionShot?: boolean | number | null
  hasMugshot?: boolean | number | null
}): AthletePhotoKind | null {
  if (photoFlagTruthy(args.hasActionShot)) return "action_shot"
  if (photoFlagTruthy(args.hasMugshot)) return "mugshot"
  return null
}

/** PortalAPI / MySQL may return photo flags as `true` or `1`. */
export function photoFlagTruthy(value: unknown): boolean {
  return value === true || value === 1
}
