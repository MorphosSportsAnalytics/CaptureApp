import { ACCESSIBLE } from "react-native-keychain"

/** Device-only Keychain accessibility — not included in iCloud backups. */
export const AUTH_SECURE_STORE_OPTIONS = {
  accessible: ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
} as const

/** Exported for unit tests. */
export const AUTH_SECURE_STORE_KEYCHAIN = ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY
