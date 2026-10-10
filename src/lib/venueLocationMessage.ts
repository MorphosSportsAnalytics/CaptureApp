import type { MobileMessages } from "@morphos/mobile-i18n"
import type { DeviceLocationFailureReason } from "./readDeviceLocation"

export function venueLocationFailureMessage(
  messages: MobileMessages,
  reason: DeviceLocationFailureReason,
): string {
  switch (reason) {
    case "permissionDenied":
      return messages.metadata.locationNeeded
    case "servicesDisabled":
      return messages.metadata.locationServicesOff
    case "unavailable":
      return messages.metadata.locationUnavailable
  }
}
