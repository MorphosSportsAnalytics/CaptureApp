import type { ClientPreprocessSidecar } from "@morphos/mobile-preprocess"
import type { PortalApiClientConfig } from "./fetch.js"
import { portalAuthHeaders, portalAuthorizedFetch, portalJson } from "./fetch.js"
import { parsePortalApiErrorBody, PortalApiError, userFacingPortalError } from "./errors.js"

export { guessVideoMime } from "./mime.js"

/** Same name as Morphos @morphos/entra-auth/headers — that package is not published. */
export const PORTAL_UPLOAD_TICKET_HEADER = "x-morphos-upload-ticket"

export type VideoUploadScope = {
  athleteId?: string
  teamId?: string
  teamEventId?: string
  dcEventId?: string
  athleteEventId?: string
  sportArenaId?: string
  eventKind?: string
  jerseyColor?: string | null
  jerseyNumber?: string | null
  kitKind?: string
  opponentJerseyPrimary?: string | null
  /** Focus schema names or catalog stat keys. Required for athlete uploads. */
  selectedFocusSchemas?: string[]
}

export type PresignResponse = {
  uploadId: string
  uploadUrl: string
  objectKey: string
  gsUri: string
  uploadTicket: string
}

export type VideoSubmissionRow = Record<string, unknown>

export type UploadProgressCallback = (loaded: number, total: number) => void

export type UploadBodySource =
  | { kind: "bytes"; bytes: Uint8Array; fileName: string; mimeType: string }
  | { kind: "stream"; stream: ReadableStream<Uint8Array>; totalBytes: number; fileName: string; mimeType: string }
  | { kind: "fileUri"; fileUri: string; fileName: string; mimeType: string }

export type PutFileUriFn = (args: {
  url: string
  headers: Record<string, string>
  fileUri: string
}) => Promise<void>

export type CompleteUploadArgs = VideoUploadScope & {
  objectKey: string
  gsUri: string
  mimeType: string
  title?: string
  durationSeconds?: number
  clientPreprocessJson?: ClientPreprocessSidecar
  originalFileName?: string | null
  recordedAtMs?: number | null
  uploadTicket: string
}

export function portalVideoObjectPutPath(objectKey: string, uploadTicket: string): string {
  const q = new URLSearchParams({
    objectKey: objectKey.trim(),
    uploadTicket: uploadTicket.trim(),
  })
  return `/v1/portal/video-uploads/object?${q.toString()}`
}

export function portalVideoObjectPutHeaders(
  cfg: PortalApiClientConfig,
  mimeType: string,
  uploadTicket: string,
): Record<string, string> {
  return {
    ...portalAuthHeaders(cfg.bearerToken),
    "Content-Type": mimeType,
    [PORTAL_UPLOAD_TICKET_HEADER]: uploadTicket.trim(),
  }
}

function completeBody(
  scope: VideoUploadScope,
  base: Omit<CompleteUploadArgs, keyof VideoUploadScope>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    objectKey: base.objectKey,
    gsUri: base.gsUri,
    mimeType: base.mimeType,
    uploadTicket: base.uploadTicket.trim(),
  }
  if (base.title != null) body.title = base.title
  if (base.durationSeconds != null) body.durationSeconds = base.durationSeconds
  if (scope.athleteId) body.athleteId = scope.athleteId
  if (scope.teamId) body.teamId = scope.teamId
  if (scope.teamEventId?.trim()) body.teamEventId = scope.teamEventId.trim()
  if (scope.dcEventId?.trim()) body.dcEventId = scope.dcEventId.trim()
  if (scope.athleteEventId?.trim()) body.athleteEventId = scope.athleteEventId.trim()
  if (scope.sportArenaId?.trim()) body.sportArenaId = scope.sportArenaId.trim()
  if (scope.eventKind?.trim()) body.eventKind = scope.eventKind.trim()
  if (scope.jerseyColor !== undefined) body.jerseyColor = scope.jerseyColor?.trim() || null
  if (scope.jerseyNumber !== undefined) body.jerseyNumber = scope.jerseyNumber?.trim() || null
  if (scope.kitKind?.trim()) body.kitKind = scope.kitKind.trim()
  if (scope.opponentJerseyPrimary !== undefined) {
    body.opponentJerseyPrimary = scope.opponentJerseyPrimary?.trim() || null
  }
  if (scope.selectedFocusSchemas && scope.selectedFocusSchemas.length > 0) {
    body.selectedFocusSchemas = scope.selectedFocusSchemas
  }
  if (base.clientPreprocessJson) body.clientPreprocessJson = base.clientPreprocessJson
  if (base.originalFileName?.trim()) body.originalFileName = base.originalFileName.trim()
  if (base.recordedAtMs != null && Number.isFinite(base.recordedAtMs)) {
    body.recordedAtMs = Math.floor(base.recordedAtMs)
  }
  return body
}

export async function presignPortalVideoUpload(
  cfg: PortalApiClientConfig,
  args: { contentType: string; fileName: string },
): Promise<PresignResponse> {
  const res = await portalJson<PresignResponse>(cfg, "/v1/portal/video-uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: args.contentType, fileName: args.fileName }),
  })
  if (!res.ok) throw new PortalApiError(res.status, res.data as Record<string, unknown>, res.error)
  return res.data
}

export async function putPortalVideoObject(
  cfg: PortalApiClientConfig,
  args: {
    objectKey: string
    mimeType: string
    uploadTicket: string
    body: Exclude<UploadBodySource, { kind: "fileUri" }>
    onProgress?: UploadProgressCallback
  },
): Promise<void> {
  const base = cfg.baseUrl.replace(/\/$/, "")
  const url = `${base}${portalVideoObjectPutPath(args.objectKey, args.uploadTicket)}`
  const headers = new Headers(portalVideoObjectPutHeaders(cfg, args.body.mimeType, args.uploadTicket))
  const timeoutMs = cfg.uploadTimeoutMs ?? 600_000

  if (args.body.kind === "bytes") {
    const res = await portalAuthorizedFetch(
      cfg,
      url,
      {
        method: "PUT",
        headers,
        body: args.body.bytes as BodyInit,
      },
      timeoutMs,
    )
    if (!res.ok) {
      const text = await res.text()
      const parsed = parsePortalApiErrorBody(text)
      throw new PortalApiError(res.status, parsed, userFacingPortalError(res.status, parsed, "Upload failed"))
    }
    args.onProgress?.(args.body.bytes.byteLength, args.body.bytes.byteLength)
    return
  }

  const res = await portalAuthorizedFetch(
    cfg,
    url,
    {
      method: "PUT",
      headers,
      body: args.body.stream,
      duplex: "half",
    } as RequestInit,
    timeoutMs,
  )
  if (!res.ok) {
    const text = await res.text()
    const parsed = parsePortalApiErrorBody(text)
    throw new PortalApiError(res.status, parsed, userFacingPortalError(res.status, parsed, "Upload failed"))
  }
  args.onProgress?.(args.body.totalBytes, args.body.totalBytes)
}

export async function completePortalVideoUpload(
  cfg: PortalApiClientConfig,
  scope: VideoUploadScope,
  args: Omit<CompleteUploadArgs, keyof VideoUploadScope>,
): Promise<VideoSubmissionRow> {
  const res = await portalJson<VideoSubmissionRow>(cfg, "/v1/portal/video-uploads/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(completeBody(scope, args)),
    timeoutMs: cfg.uploadTimeoutMs ?? 120_000,
  })
  if (!res.ok) throw new PortalApiError(res.status, res.data as Record<string, unknown>, res.error)
  return res.data
}

export async function submitPortalVideoForAnalysis(
  cfg: PortalApiClientConfig,
  submissionId: string,
): Promise<VideoSubmissionRow> {
  const id = submissionId.trim()
  const res = await portalJson<VideoSubmissionRow>(
    cfg,
    `/v1/portal/video-submissions/${encodeURIComponent(id)}/submit-for-analysis`,
    { method: "POST" },
  )
  if (!res.ok) throw new PortalApiError(res.status, res.data as Record<string, unknown>, res.error)
  return res.data
}

export type RunPresignedUploadArgs = VideoUploadScope & {
  body: UploadBodySource
  durationSeconds?: number
  title?: string
  clientPreprocessJson?: ClientPreprocessSidecar
  recordedAtMs?: number | null
  onProgress?: UploadProgressCallback
  autoSubmitForAnalysis?: boolean
  putFileUri?: PutFileUriFn
}

/** Full mobile upload: presign → PUT object → complete → optional submit-for-analysis. */
export async function runPresignedPortalVideoUpload(
  cfg: PortalApiClientConfig,
  args: RunPresignedUploadArgs,
): Promise<VideoSubmissionRow> {
  const mime = args.body.mimeType
  const fileName = args.body.fileName
  const presign = await presignPortalVideoUpload(cfg, { contentType: mime, fileName })
  const uploadTicket = presign.uploadTicket?.trim() ?? ""
  if (!presign.objectKey?.trim() || !presign.gsUri?.trim() || !uploadTicket) {
    throw new PortalApiError(503, {}, "Could not prepare upload.")
  }

  if (args.body.kind === "fileUri") {
    if (!args.putFileUri) {
      throw new PortalApiError(500, {}, "Could not prepare upload.")
    }
    const base = cfg.baseUrl.replace(/\/$/, "")
    await args.putFileUri({
      url: `${base}${portalVideoObjectPutPath(presign.objectKey, uploadTicket)}`,
      headers: portalVideoObjectPutHeaders(cfg, mime, uploadTicket),
      fileUri: args.body.fileUri,
    })
    args.onProgress?.(1, 1)
  } else {
    await putPortalVideoObject(cfg, {
      objectKey: presign.objectKey,
      mimeType: mime,
      uploadTicket,
      body: args.body,
      onProgress: args.onProgress,
    })
  }

  const row = await completePortalVideoUpload(cfg, args, {
    objectKey: presign.objectKey,
    gsUri: presign.gsUri,
    mimeType: mime,
    title: args.title ?? fileName,
    durationSeconds: args.durationSeconds,
    clientPreprocessJson: args.clientPreprocessJson,
    originalFileName: fileName,
    recordedAtMs: args.recordedAtMs ?? null,
    uploadTicket,
  })
  const submissionId = typeof row.id === "string" ? row.id.trim() : ""
  if (args.autoSubmitForAnalysis !== false && submissionId && !args.teamEventId?.trim()) {
    await submitPortalVideoForAnalysis(cfg, submissionId)
  }
  return row
}

export type AthleteStatMenu = {
  mode: "athlete_pick" | "team_full" | "team_starter" | "none"
  pickCount: number | null
  tier: string | null
  stats: { schemaName: string; statKey: string; label: string }[]
}

export async function fetchAthleteStatMenu(
  cfg: PortalApiClientConfig,
  scope: { athleteId?: string; teamId?: string },
): Promise<AthleteStatMenu> {
  const q = new URLSearchParams()
  if (scope.teamId?.trim()) q.set("teamId", scope.teamId.trim())
  else if (scope.athleteId?.trim()) q.set("athleteId", scope.athleteId.trim())
  const res = await portalJson<AthleteStatMenu>(cfg, `/v1/portal/athlete-stat-menu?${q.toString()}`)
  if (!res.ok) throw new PortalApiError(res.status, res.data as Record<string, unknown>, res.error)
  return res.data
}
