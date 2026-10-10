import { getMobileMessages, type MobileMessages } from "@morphos/mobile-i18n"

export const BOOT_PHASES = ["jsStarted", "rootLayout", "restoringSession", "sessionReady"] as const
export type BootPhase = (typeof BOOT_PHASES)[number]

export type BootLogSnapshot = {
  phase: BootPhase
  fatalError: unknown | null
  lastError: unknown | null
  componentStack: string
}

export const BOOT_LOG_PREFIX = "MorphosCapture boot"

const listeners = new Set<() => void>()

let snapshot: BootLogSnapshot = emptySnapshot()

function emptySnapshot(): BootLogSnapshot {
  return {
    phase: "jsStarted",
    fatalError: null,
    lastError: null,
    componentStack: "",
  }
}

export function resetBootLog(): void {
  snapshot = emptySnapshot()
  emit()
}

export function getBootLogSnapshot(): BootLogSnapshot {
  return snapshot
}

export function subscribeBootLog(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emit(): void {
  for (const listener of listeners) listener()
}

export function isBootPhase(value: string): value is BootPhase {
  return (BOOT_PHASES as readonly string[]).includes(value)
}

export function recordBootPhase(phase: BootPhase): void {
  snapshot = { ...snapshot, phase }
  console.info(`${BOOT_LOG_PREFIX} phase=${phase}`)
  emit()
}

export function recordBootError(error: unknown, fatal: boolean, componentStack = ""): void {
  snapshot = {
    ...snapshot,
    lastError: error,
    fatalError: fatal ? error : snapshot.fatalError,
    componentStack: componentStack || snapshot.componentStack,
  }
  const formatted = formatUnknownError(error)
  console.error(`${BOOT_LOG_PREFIX} ${fatal ? "fatal" : "error"} ${formatted.message}`)
  if (formatted.stack) console.error(formatted.stack)
  if (componentStack) console.error(componentStack)
  emit()
}

export function clearFatalError(): void {
  snapshot = { ...snapshot, fatalError: null, componentStack: "" }
  emit()
}

export function bootIsComplete(phase: BootPhase): boolean {
  return phase === "sessionReady"
}

export function shouldTreatAsFatal(isFatalFlag: boolean, phase: BootPhase): boolean {
  return isFatalFlag || !bootIsComplete(phase)
}

export function formatUnknownError(error: unknown): { message: string; stack: string } {
  if (error instanceof Error) {
    return {
      message: error.message.trim() || error.name,
      stack: error.stack ?? "",
    }
  }
  if (typeof error === "string") {
    return { message: error.trim(), stack: "" }
  }
  try {
    const json = JSON.stringify(error)
    if (json && json !== "null" && json !== "{}") {
      return { message: json, stack: "" }
    }
  } catch {
    /* circular objects fall through */
  }
  return { message: String(error), stack: "" }
}

export function bootPhaseLabel(messages: MobileMessages, phase: BootPhase): string {
  return messages.diagnostics.phases[phase]
}

export function diagnosticMessages(locale?: string | null): MobileMessages {
  return getMobileMessages(locale)
}
