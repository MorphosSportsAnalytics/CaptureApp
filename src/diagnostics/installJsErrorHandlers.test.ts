import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { getBootLogSnapshot, recordBootPhase, resetBootLog } from "./bootLog.js"
import {
  installJsErrorHandlers,
  nativeJsErrorRuntime,
  readErrorUtils,
  type ErrorUtilsLike,
  type UnhandledRejectionTarget,
} from "./installJsErrorHandlers.js"
import { setSplashLoaderForTests } from "./nativeSplash.js"

afterEach(() => {
  resetBootLog()
  setSplashLoaderForTests(null)
})

describe("installJsErrorHandlers", () => {
  it("readErrorUtils requires both get and set", () => {
    assert.equal(readErrorUtils({}), null)
    assert.equal(readErrorUtils({ ErrorUtils: { getGlobalHandler: () => () => {} } as unknown as ErrorUtilsLike }), null)
    assert.equal(readErrorUtils({ ErrorUtils: { setGlobalHandler: () => {} } as unknown as ErrorUtilsLike }), null)
    const utils: ErrorUtilsLike = {
      getGlobalHandler: () => () => {},
      setGlobalHandler: () => {},
    }
    assert.equal(readErrorUtils({ ErrorUtils: utils }), utils)
  })

  it("native runtime reads ErrorUtils from globalThis when present", () => {
    const runtime = nativeJsErrorRuntime()
    assert.equal(runtime.rejectionTarget, globalThis)
    assert.equal(runtime.errorUtils, readErrorUtils())
  })

  it("records fatal ErrorUtils errors and restores the previous handler", () => {
    setSplashLoaderForTests(() => null)
    const calls: unknown[] = []
    const previous = (error: unknown, isFatal?: boolean) => {
      calls.push([error, isFatal])
    }
    const utils: ErrorUtilsLike = {
      getGlobalHandler: () => previous,
      setGlobalHandler: (next) => {
        utils.getGlobalHandler = () => next
      },
    }
    const nativeFatal = new Error("native fatal")
    const after = new Error("after")
    const uninstall = installJsErrorHandlers({ errorUtils: utils, rejectionTarget: {} })
    utils.getGlobalHandler()(nativeFatal, true)
    assert.equal((getBootLogSnapshot().fatalError as Error).message, "native fatal")
    uninstall()
    utils.getGlobalHandler()(after, true)
    assert.deepEqual(calls, [
      [nativeFatal, true],
      [after, true],
    ])
  })

  it("does not replace the UI for non-fatal ErrorUtils reports during boot", () => {
    setSplashLoaderForTests(() => null)
    const utils: ErrorUtilsLike = {
      getGlobalHandler: () => () => {},
      setGlobalHandler: (next) => {
        utils.getGlobalHandler = () => next
      },
    }
    const uninstall = installJsErrorHandlers({ errorUtils: utils, rejectionTarget: {} })
    utils.getGlobalHandler()(new Error("recoverable"), false)
    assert.equal(getBootLogSnapshot().fatalError, null)
    assert.equal((getBootLogSnapshot().lastError as Error).message, "recoverable")
    uninstall()
  })

  it("uninstalls without throwing when there was no previous ErrorUtils handler", () => {
    setSplashLoaderForTests(() => null)
    const utils: ErrorUtilsLike = {
      getGlobalHandler: () => undefined as unknown as (error: unknown, isFatal?: boolean) => void,
      setGlobalHandler: () => {},
    }
    const uninstall = installJsErrorHandlers({ errorUtils: utils, rejectionTarget: {} })
    assert.doesNotThrow(() => uninstall())
  })

  it("still installs when ErrorUtils is missing", () => {
    setSplashLoaderForTests(() => null)
    const target: UnhandledRejectionTarget = {}
    const uninstall = installJsErrorHandlers({ errorUtils: null, rejectionTarget: target })
    assert.equal(typeof target.onunhandledrejection, "function")
    uninstall()
    assert.equal(target.onunhandledrejection, null)
  })

  it("treats unhandled rejections during boot as fatal", () => {
    setSplashLoaderForTests(() => null)
    const previousCalls: unknown[] = []
    const target: UnhandledRejectionTarget = {
      onunhandledrejection: (event) => previousCalls.push(event.reason),
    }
    const uninstall = installJsErrorHandlers({ errorUtils: null, rejectionTarget: target })
    recordBootPhase("restoringSession")
    target.onunhandledrejection?.({ reason: "no session" })
    assert.equal(getBootLogSnapshot().fatalError, "no session")
    assert.deepEqual(previousCalls, ["no session"])
    uninstall()
  })

  it("does not replace the UI for unhandled rejections after boot", () => {
    setSplashLoaderForTests(() => null)
    const target: UnhandledRejectionTarget = {}
    const uninstall = installJsErrorHandlers({ errorUtils: null, rejectionTarget: target })
    recordBootPhase("sessionReady")
    target.onunhandledrejection?.({ reason: new Error("background") })
    assert.equal(getBootLogSnapshot().fatalError, null)
    assert.equal((getBootLogSnapshot().lastError as Error).message, "background")
    uninstall()
  })
})
