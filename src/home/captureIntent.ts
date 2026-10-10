import type { CaptureRouteParams } from "./captureParams"

let pending: CaptureRouteParams | null = null
let revision = 0
const listeners = new Set<() => void>()

function emit(): void {
  revision += 1
  for (const listener of listeners) listener()
}

export function setCaptureIntent(params: CaptureRouteParams): void {
  pending = { ...params }
  emit()
}

export function peekCaptureIntent(): CaptureRouteParams | null {
  return pending ? { ...pending } : null
}

export function consumeCaptureIntent(): CaptureRouteParams | null {
  const next = pending
  pending = null
  if (next) emit()
  return next ? { ...next } : null
}

export function clearCaptureIntent(): void {
  if (!pending) return
  pending = null
  emit()
}

export function subscribeCaptureIntent(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getCaptureIntentRevision(): number {
  return revision
}
