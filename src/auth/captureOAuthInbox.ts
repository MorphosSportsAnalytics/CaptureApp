import { parseCaptureOAuthReturn } from "./captureOAuthReturn"

let inbox: string | null = null
const listeners = new Set<(url: string) => void>()

export function pushCaptureOAuthUrl(url: string): boolean {
  if (!parseCaptureOAuthReturn(url)) return false
  inbox = url
  for (const listener of listeners) listener(url)
  return true
}

export function takeCaptureOAuthUrl(): string | null {
  const url = inbox
  inbox = null
  return url
}

export function peekCaptureOAuthUrl(): string | null {
  return inbox
}

export function clearCaptureOAuthInbox(): void {
  inbox = null
}

export function subscribeCaptureOAuthUrl(listener: (url: string) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function waitForCaptureOAuthUrl(timeoutMs: number): Promise<string | null> {
  if (inbox) return Promise.resolve(inbox)
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe()
      resolve(inbox)
    }, timeoutMs)
    const unsubscribe = subscribeCaptureOAuthUrl((url) => {
      clearTimeout(timer)
      unsubscribe()
      resolve(url)
    })
  })
}
