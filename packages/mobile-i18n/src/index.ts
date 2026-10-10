import enCA from "./locales/en-CA.json" with { type: "json" }
import esES from "./locales/es-ES.json" with { type: "json" }
import svSE from "./locales/sv-SE.json" with { type: "json" }

export type MobileLocale = "en-CA" | "es-ES" | "sv-SE"

export type MobileMessages = typeof enCA

const catalogs: Record<MobileLocale, MobileMessages> = {
  "en-CA": enCA,
  "es-ES": esES as MobileMessages,
  "sv-SE": svSE as MobileMessages,
}

export function getMobileMessages(locale: string | null | undefined): MobileMessages {
  const key = (locale ?? "en-CA") as MobileLocale
  return catalogs[key] ?? catalogs["en-CA"]
}

/** Clip cap shown on Capture and Account. Does not invent a catalog duration without a subscription. */
export function maxClipLengthLabel(
  messages: MobileMessages,
  args: { maxDurationSeconds: number; hasSubscription: boolean },
): string {
  if (!args.hasSubscription || args.maxDurationSeconds <= 0) {
    return messages.capture.maxDurationNoSubscription
  }
  return t(messages, "capture.maxDuration", { minutes: Math.round(args.maxDurationSeconds / 60) })
}

/** Resolve dotted key path e.g. `qc.too_blurry` with `{minutes}` interpolation. */
export function t(
  messages: MobileMessages,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const parts = key.split(".")
  let cur: unknown = messages
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return key
    cur = (cur as Record<string, unknown>)[p]
  }
  let out = typeof cur === "string" ? cur : key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v))
    }
  }
  return out
}

export function qcFailureMessage(messages: MobileMessages, reason: string): string {
  const qc = messages.qc as Record<string, string>
  return qc[reason] ?? messages.qc.failedTitle
}
