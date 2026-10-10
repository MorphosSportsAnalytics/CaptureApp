import { PortalApiError } from "@morphos/portal-api-client"
import type { MobileMessages } from "@morphos/mobile-i18n"

export function portalLoadErrorMessage(err: unknown, messages: MobileMessages): string {
  if (err instanceof PortalApiError && err.status === 401) {
    return messages.errors.sessionExpired
  }
  if (err instanceof Error && /unauthorized/i.test(err.message)) {
    return messages.errors.sessionExpired
  }
  return messages.errors.network
}
