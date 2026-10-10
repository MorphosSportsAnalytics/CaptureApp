export type PortalApiErrorBody = {
  error?: string
  code?: string
  maxSeconds?: number
  durationSeconds?: number
}

export function parsePortalApiErrorBody(text: string): PortalApiErrorBody {
  try {
    return JSON.parse(text) as PortalApiErrorBody
  } catch {
    return {}
  }
}

export function userFacingPortalError(status: number, body: PortalApiErrorBody, fallback: string): string {
  if (body.error?.trim()) return body.error.trim()
  if (status === 402) return "An active subscription is required to upload videos."
  if (status === 429) return "Upload quota reached for this billing period."
  if (body.code === "video_too_long" && body.maxSeconds != null) {
    return `Video is too long (max ${body.maxSeconds}s). Trim the clip and try again.`
  }
  return fallback
}

export class PortalApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly body: PortalApiErrorBody

  constructor(status: number, body: PortalApiErrorBody, message: string) {
    super(message)
    this.name = "PortalApiError"
    this.status = status
    this.code = body.code
    this.body = body
  }
}
