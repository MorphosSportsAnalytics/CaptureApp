export {
  CLIENT_PREPROCESS_VERSION,
  DEFAULT_QC_THRESHOLDS,
  validateClientPreprocessSidecar,
  type ClientPreprocessCapture,
  type ClientPreprocessQc,
  type ClientPreprocessSidecar,
  type ClientPreprocessTranscode,
  type QcFailureReason,
  type QcThresholds,
  type TimeInterval,
  type ValidateSidecarResult,
} from "./schema.js"

export {
  activeCoverage,
  complementIntervals,
  coverageDelta,
  mergeOverlappingIntervals,
  totalIntervalDuration,
  trimToTierMax,
  trimWindowForTierMax,
} from "./intervals.js"

export {
  RECOMMENDED_OUTPUT_PROFILE,
  buildQcMetrics,
  evaluateQc,
  type QcEvaluation,
} from "./qc.js"

export {
  OUTPUT_LONG_EDGE,
  OUTPUT_SHORT_EDGE,
  SKILL_CLIP_MAX_FPS,
  capOutputSize,
  evenDimension,
  isH264Codec,
  maxOutputFps,
  planTranscode,
  type SourceVideoProbe,
  type TranscodePlan,
} from "./transcodePlan.js"
