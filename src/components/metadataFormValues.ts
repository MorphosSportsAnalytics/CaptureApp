export type MetadataFormValues = {
  eventKind: string
  sportArenaId: string
  jerseyColor: string
  jerseyNumber: string
  skillClipMode: boolean
}

const METADATA_KEYS = [
  "eventKind",
  "sportArenaId",
  "jerseyColor",
  "jerseyNumber",
  "skillClipMode",
] as const satisfies ReadonlyArray<keyof MetadataFormValues>

export function applyMetadataPatch(
  current: MetadataFormValues,
  patch: Partial<MetadataFormValues>,
): MetadataFormValues {
  let changed = false
  const next: MetadataFormValues = { ...current }
  for (const key of METADATA_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue
    const value = patch[key]
    if (value === undefined || value === current[key]) continue
    ;(next[key] as MetadataFormValues[typeof key]) = value
    changed = true
  }
  return changed ? next : current
}

export function metadataPatchIfChanged(
  current: MetadataFormValues,
  patch: Partial<MetadataFormValues>,
): Partial<MetadataFormValues> | null {
  return applyMetadataPatch(current, patch) === current ? null : patch
}
