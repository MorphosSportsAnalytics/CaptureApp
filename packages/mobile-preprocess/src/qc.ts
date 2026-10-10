import type { ClientPreprocessQc, QcFailureReason, QcThresholds } from "./schema.js"
import { DEFAULT_QC_THRESHOLDS } from "./schema.js"

export type QcEvaluation = {
  passed: boolean
  failures: QcFailureReason[]
}

export function evaluateQc(qc: Omit<ClientPreprocessQc, "passed">, thresholds: QcThresholds = DEFAULT_QC_THRESHOLDS): QcEvaluation {
  const failures: QcFailureReason[] = []
  if (qc.subjectVisibleRatio < thresholds.minSubjectVisibleRatio) failures.push("subject_not_visible")
  if (qc.jerseyVisibleRatio < thresholds.minJerseyVisibleRatio) failures.push("jersey_not_visible")
  if (qc.blur > thresholds.maxBlur) failures.push("too_blurry")
  if (qc.shake > thresholds.maxShake) failures.push("too_shaky")
  if (qc.darkness > thresholds.maxDarkness) failures.push("too_dark")
  return { passed: failures.length === 0, failures }
}

export function buildQcMetrics(samples: {
  blur: number
  shake: number
  darkness: number
  subjectVisibleRatio: number
  jerseyVisibleRatio: number
}): ClientPreprocessQc {
  const evaluation = evaluateQc(samples)
  return { ...samples, passed: evaluation.passed }
}

export { RECOMMENDED_OUTPUT_PROFILE } from "./transcodePlan.js"
