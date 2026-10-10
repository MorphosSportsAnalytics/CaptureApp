/**
 * Hermes (React Native) has AbortController but not AbortSignal.timeout.
 * Prefer the native helper when present; otherwise abort with a timer.
 */
export function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  if (init.signal != null) {
    return Promise.resolve().then(() => fetchImpl(url, init))
  }
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return Promise.resolve().then(() => fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }))
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return Promise.resolve()
    .then(() => fetchImpl(url, { ...init, signal: controller.signal }))
    .finally(() => {
      clearTimeout(timer)
    })
}
