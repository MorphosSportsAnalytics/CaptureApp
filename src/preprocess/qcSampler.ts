/** Heuristic QC placeholders. Duration must come from the system picker, not this sampler. */
export type QcSample = {
  durationSeconds: number
  blur: number
  shake: number
  darkness: number
  subjectVisibleRatio: number
  jerseyVisibleRatio: number
}

export async function sampleQcFromVideo(_uri: string, durationSeconds: number): Promise<QcSample> {
  return {
    durationSeconds,
    blur: 0.2,
    shake: 0.15,
    darkness: 0.2,
    subjectVisibleRatio: 0.75,
    jerseyVisibleRatio: 0.55,
  }
}
