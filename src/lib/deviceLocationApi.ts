import { Platform } from "react-native"
import Geolocation from "@react-native-community/geolocation"
import { check, request, PERMISSIONS, RESULTS } from "react-native-permissions"
import type { DeviceLocationApi, LocationFix } from "./readDeviceLocation"

const permission =
  Platform.OS === "ios" ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE : PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION

function statusOf(result: string): "granted" | "denied" {
  return result === RESULTS.GRANTED || result === RESULTS.LIMITED ? "granted" : "denied"
}

function positionToFix(position: {
  coords: { latitude: number; longitude: number; accuracy: number }
  timestamp: number
}): LocationFix {
  return {
    coords: {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy ?? null,
    },
    timestamp: position.timestamp,
  }
}

export const deviceLocationApi: DeviceLocationApi = {
  getForegroundPermissionsAsync: async () => ({ status: statusOf(await check(permission)) }),
  requestForegroundPermissionsAsync: async () => ({ status: statusOf(await request(permission)) }),
  hasServicesEnabledAsync: async () => true,
  getLastKnownPositionAsync: () =>
    new Promise((resolve) => {
      Geolocation.getCurrentPosition(
        (pos) => resolve(positionToFix(pos)),
        () => resolve(null),
        { enableHighAccuracy: false, maximumAge: 15 * 60 * 1000, timeout: 4000 },
      )
    }),
  getCurrentPositionAsync: () =>
    new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (pos) => resolve(positionToFix(pos)),
        (err) => reject(err),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
      )
    }),
}
