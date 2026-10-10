/** Client-side mirror of the server pick rule. The API still rejects a bad count. */
export function athleteUploadSelectionReady(
  mode: string | undefined,
  pickCount: number | null | undefined,
  selected: readonly string[],
): boolean {
  if (mode !== "athlete_pick") return true
  return typeof pickCount === "number" && selected.length === pickCount
}
