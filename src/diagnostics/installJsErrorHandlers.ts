import {
  getBootLogSnapshot,
  recordBootError,
  recordBootPhase,
  shouldTreatAsFatal,
} from "./bootLog"
import { preventAutoHideSplash } from "./nativeSplash"

export type ErrorUtilsLike = {
  getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void
  setGlobalHandler: (next: (error: unknown, isFatal?: boolean) => void) => void
}

export type UnhandledRejectionTarget = {
  onunhandledrejection?: ((event: { reason: unknown }) => void) | null
}

export type JsErrorRuntime = {
  errorUtils: ErrorUtilsLike | null
  rejectionTarget: UnhandledRejectionTarget
}

export function readErrorUtils(globalRef: { ErrorUtils?: ErrorUtilsLike } = globalThis as never): ErrorUtilsLike | null {
  const utils = globalRef.ErrorUtils
  if (!utils || typeof utils.getGlobalHandler !== "function" || typeof utils.setGlobalHandler !== "function") {
    return null
  }
  return utils
}

export function nativeJsErrorRuntime(): JsErrorRuntime {
  return {
    errorUtils: readErrorUtils(),
    rejectionTarget: globalThis as UnhandledRejectionTarget,
  }
}

export function installJsErrorHandlers(runtime: JsErrorRuntime = nativeJsErrorRuntime()): () => void {
  recordBootPhase("jsStarted")
  void preventAutoHideSplash()

  const previousHandler = runtime.errorUtils?.getGlobalHandler()
  runtime.errorUtils?.setGlobalHandler((error, isFatal) => {
    recordBootError(error, Boolean(isFatal))
    previousHandler?.(error, isFatal)
  })

  const previousRejection = runtime.rejectionTarget.onunhandledrejection ?? null
  runtime.rejectionTarget.onunhandledrejection = (event) => {
    const fatal = shouldTreatAsFatal(false, getBootLogSnapshot().phase)
    recordBootError(event.reason, fatal)
    previousRejection?.(event)
  }

  return () => {
    if (runtime.errorUtils && previousHandler) {
      runtime.errorUtils.setGlobalHandler(previousHandler)
    }
    runtime.rejectionTarget.onunhandledrejection = previousRejection
  }
}
