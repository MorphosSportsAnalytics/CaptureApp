import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  LocationAccuracy,
  readDeviceLocation,
  type DeviceLocationApi,
} from "./readDeviceLocation.js"

function mockApi(overrides: Partial<DeviceLocationApi> = {}): DeviceLocationApi {
  return {
    getForegroundPermissionsAsync: async () => ({ status: "granted" }),
    requestForegroundPermissionsAsync: async () => ({ status: "granted" }),
    hasServicesEnabledAsync: async () => true,
    getLastKnownPositionAsync: async () => null,
    getCurrentPositionAsync: async () => ({
      coords: { latitude: 45.5, longitude: -73.5, accuracy: 800 },
      timestamp: Date.now(),
    }),
    ...overrides,
  }
}

describe("readDeviceLocation", () => {
  it("uses lowest accuracy only for current position (no balanced GPS)", async () => {
    const accuracies: number[] = []
    const api = mockApi({
      getCurrentPositionAsync: async (options) => {
        if (options?.accuracy != null) accuracies.push(options.accuracy)
        return {
          coords: { latitude: 45.5, longitude: -73.5, accuracy: 800 },
          timestamp: Date.now(),
        }
      },
    })
    const result = await readDeviceLocation(api)
    assert.equal(result.ok, true)
    assert.deepEqual(accuracies, [LocationAccuracy.Lowest])
  })
})
