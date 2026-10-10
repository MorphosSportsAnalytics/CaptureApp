import { withTimeout } from "./withTimeout"

/** Accuracy levels for the device location adapter (injected for tests). */
export const LocationAccuracy = {
  Lowest: 1,
  Balanced: 3,
} as const

export type LocationAccuracyValue = (typeof LocationAccuracy)[keyof typeof LocationAccuracy]

export type LocationCoords = {
  latitude: number
  longitude: number
  accuracy: number | null
}

export type LocationFix = {
  coords: LocationCoords
  timestamp: number
}

export type DeviceLocationApi = {
  getForegroundPermissionsAsync: () => Promise<{ status: string }>
  requestForegroundPermissionsAsync: () => Promise<{ status: string }>
  hasServicesEnabledAsync: () => Promise<boolean>
  getLastKnownPositionAsync: (options?: {
    maxAge?: number
    requiredAccuracy?: number
  }) => Promise<LocationFix | null>
  getCurrentPositionAsync: (options?: {
    accuracy?: LocationAccuracyValue
    mayShowUserSettingsDialog?: boolean
  }) => Promise<LocationFix>
}

export type DeviceLocationFailureReason = "permissionDenied" | "servicesDisabled" | "unavailable"

export type DeviceLocationResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; reason: DeviceLocationFailureReason }

export type ReadDeviceLocationOptions = {
  /** Max age for last-known fix (ms). Default 15 minutes. */
  lastKnownMaxAgeMs?: number
  /** Max accuracy radius for last-known fix (m). Default 1000 (coarse). */
  lastKnownMaxAccuracyM?: number
  lowestTimeoutMs?: number
}

const DEFAULT_LAST_KNOWN_MAX_AGE_MS = 15 * 60 * 1000
const DEFAULT_LAST_KNOWN_MAX_ACCURACY_M = 1000
const DEFAULT_LOWEST_TIMEOUT_MS = 5000

function isFreshLastKnown(
  fix: LocationFix,
  maxAgeMs: number,
  maxAccuracyM: number,
  nowMs: number,
): boolean {
  if (nowMs - fix.timestamp > maxAgeMs) return false
  const accuracy = fix.coords.accuracy
  if (accuracy == null || !Number.isFinite(accuracy)) return true
  return accuracy <= maxAccuracyM
}

function fixToCoords(fix: LocationFix): { lat: number; lng: number } {
  return { lat: fix.coords.latitude, lng: fix.coords.longitude }
}

async function readCurrentPositionWithTimeout(
  api: DeviceLocationApi,
  accuracy: LocationAccuracyValue,
  timeoutMs: number,
): Promise<LocationFix | null> {
  try {
    return await withTimeout(
      api.getCurrentPositionAsync({
        accuracy,
        mayShowUserSettingsDialog: true,
      }),
      timeoutMs,
      null,
    )
  } catch {
    return null
  }
}

async function ensureForegroundPermission(api: DeviceLocationApi): Promise<boolean> {
  const current = await api.getForegroundPermissionsAsync()
  if (current.status === "granted") return true
  const requested = await api.requestForegroundPermissionsAsync()
  return requested.status === "granted"
}

async function readFilteredLastKnown(
  api: DeviceLocationApi,
  maxAgeMs: number,
  maxAccuracyM: number,
): Promise<LocationFix | null> {
  try {
    return await api.getLastKnownPositionAsync({
      maxAge: maxAgeMs,
      requiredAccuracy: maxAccuracyM,
    })
  } catch {
    return null
  }
}

async function readUnfilteredLastKnown(api: DeviceLocationApi): Promise<LocationFix | null> {
  try {
    return await api.getLastKnownPositionAsync()
  } catch {
    return null
  }
}

/** Read device coordinates for nearest-venue lookup; never throws for expected GPS failure. */
export async function readDeviceLocation(
  api: DeviceLocationApi,
  options: ReadDeviceLocationOptions = {},
  nowMs = Date.now(),
): Promise<DeviceLocationResult> {
  const lastKnownMaxAgeMs = options.lastKnownMaxAgeMs ?? DEFAULT_LAST_KNOWN_MAX_AGE_MS
  const lastKnownMaxAccuracyM = options.lastKnownMaxAccuracyM ?? DEFAULT_LAST_KNOWN_MAX_ACCURACY_M
  const lowestTimeoutMs = options.lowestTimeoutMs ?? DEFAULT_LOWEST_TIMEOUT_MS

  const granted = await ensureForegroundPermission(api)
  if (!granted) {
    return { ok: false, reason: "permissionDenied" }
  }

  const servicesEnabled = await api.hasServicesEnabledAsync()

  const filteredLastKnown = await readFilteredLastKnown(api, lastKnownMaxAgeMs, lastKnownMaxAccuracyM)
  if (
    filteredLastKnown &&
    isFreshLastKnown(filteredLastKnown, lastKnownMaxAgeMs, lastKnownMaxAccuracyM, nowMs)
  ) {
    return { ok: true, ...fixToCoords(filteredLastKnown) }
  }

  const lowest = await readCurrentPositionWithTimeout(api, LocationAccuracy.Lowest, lowestTimeoutMs)
  if (lowest) {
    return { ok: true, ...fixToCoords(lowest) }
  }

  const unfilteredLastKnown = await readUnfilteredLastKnown(api)
  if (unfilteredLastKnown) {
    return { ok: true, ...fixToCoords(unfilteredLastKnown) }
  }

  if (!servicesEnabled) {
    return { ok: false, reason: "servicesDisabled" }
  }

  return { ok: false, reason: "unavailable" }
}
