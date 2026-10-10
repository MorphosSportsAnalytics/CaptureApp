import * as Keychain from "react-native-keychain"
import { AUTH_SECURE_STORE_OPTIONS } from "./secureStorePolicy"

const SERVICE = "com.morphosanalytics.capture.auth"

async function readAll(): Promise<Record<string, string>> {
  try {
    const result = await Keychain.getGenericPassword({ service: SERVICE })
    if (!result) return {}
    const parsed = JSON.parse(result.password) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    return parsed as Record<string, string>
  } catch {
    return {}
  }
}

async function writeAll(values: Record<string, string>): Promise<void> {
  await Keychain.setGenericPassword("morphos", JSON.stringify(values), {
    service: SERVICE,
    ...AUTH_SECURE_STORE_OPTIONS,
  })
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  const current = await readAll()
  current[key] = value
  await writeAll(current)
}

export async function getItemAsync(key: string): Promise<string | null> {
  const current = await readAll()
  return current[key] ?? null
}

export async function deleteItemAsync(key: string): Promise<void> {
  const current = await readAll()
  if (!(key in current)) return
  delete current[key]
  if (Object.keys(current).length === 0) {
    await Keychain.resetGenericPassword({ service: SERVICE })
    return
  }
  await writeAll(current)
}
