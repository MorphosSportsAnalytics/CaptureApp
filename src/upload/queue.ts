import {
  guessVideoMime,
  runPresignedPortalVideoUpload,
  type PortalApiClientConfig,
  type UploadProgressCallback,
} from "@morphos/portal-api-client"
import type { ClientPreprocessSidecar } from "@morphos/mobile-preprocess"
import { pathExists, uploadBinary } from "@/lib/deviceFile"

export type QueuedUpload = {
  id: string
  fileUri: string
  fileName: string
  athleteId?: string
  teamId?: string
  durationSeconds?: number
  clientPreprocessJson?: ClientPreprocessSidecar
  sportArenaId?: string
  eventKind?: string
  jerseyColor?: string
  jerseyNumber?: string
  teamEventId?: string
  dcEventId?: string
  athleteEventId?: string
  kitKind?: string
  opponentJerseyPrimary?: string
  recordedAtMs?: number | null
  autoSubmit?: boolean
  /** Focus schema names. Omitted for team games; the server expands those. */
  selectedFocusSchemas?: string[]
}

type Listener = (job: UploadJobState) => void

export type UploadJobState = {
  id: string
  status: "pending" | "uploading" | "success" | "error"
  percent: number
  error?: string
}

const jobs = new Map<string, UploadJobState>()
const listeners = new Set<Listener>()

function emit(job: UploadJobState) {
  for (const l of listeners) l(job)
}

export function subscribeUploadJobs(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getUploadJob(id: string): UploadJobState | undefined {
  return jobs.get(id)
}

export async function enqueueUpload(
  cfg: PortalApiClientConfig,
  item: QueuedUpload,
  onProgress?: UploadProgressCallback,
): Promise<Record<string, unknown>> {
  const state: UploadJobState = { id: item.id, status: "uploading", percent: 0 }
  jobs.set(item.id, state)
  emit(state)

  try {
    if (!(await pathExists(item.fileUri))) throw new Error("Video file not found")

    const mimeType = guessVideoMime(item.fileName)
    const row = await runPresignedPortalVideoUpload(cfg, {
      athleteId: item.athleteId,
      teamId: item.teamId,
      teamEventId: item.teamEventId,
      dcEventId: item.dcEventId,
      athleteEventId: item.athleteEventId,
      body: {
        kind: "fileUri",
        fileUri: item.fileUri,
        fileName: item.fileName,
        mimeType,
      },
      putFileUri: async ({ url, headers, fileUri }) => {
        const status = await uploadBinary(url, fileUri, headers)
        if (status < 200 || status >= 300) {
          throw new Error(`Upload failed (${status})`)
        }
      },
      durationSeconds: item.durationSeconds,
      clientPreprocessJson: item.clientPreprocessJson,
      sportArenaId: item.sportArenaId,
      eventKind: item.eventKind,
      jerseyColor: item.jerseyColor,
      jerseyNumber: item.jerseyNumber,
      kitKind: item.kitKind,
      opponentJerseyPrimary: item.opponentJerseyPrimary,
      recordedAtMs: item.recordedAtMs ?? null,
      autoSubmitForAnalysis: item.autoSubmit !== false,
      selectedFocusSchemas: item.selectedFocusSchemas,
      onProgress: (loaded, total) => {
        const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0
        const next = { ...state, percent }
        jobs.set(item.id, next)
        emit(next)
        onProgress?.(loaded, total)
      },
    })

    const done: UploadJobState = { id: item.id, status: "success", percent: 100 }
    jobs.set(item.id, done)
    emit(done)
    return row
  } catch (err) {
    const failed: UploadJobState = {
      id: item.id,
      status: "error",
      percent: 0,
      error: err instanceof Error ? err.message : "Upload failed",
    }
    jobs.set(item.id, failed)
    emit(failed)
    throw err
  }
}
