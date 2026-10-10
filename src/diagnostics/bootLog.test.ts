import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { getMobileMessages } from "@morphos/mobile-i18n"
import {
  BOOT_LOG_PREFIX,
  bootIsComplete,
  bootPhaseLabel,
  clearFatalError,
  diagnosticMessages,
  formatUnknownError,
  getBootLogSnapshot,
  isBootPhase,
  recordBootError,
  recordBootPhase,
  resetBootLog,
  shouldTreatAsFatal,
  subscribeBootLog,
} from "./bootLog.js"

afterEach(() => {
  resetBootLog()
})

describe("bootLog", () => {
  it("records phases and notifies subscribers", () => {
    const seen: string[] = []
    const stop = subscribeBootLog(() => seen.push(getBootLogSnapshot().phase))
    recordBootPhase("rootLayout")
    recordBootPhase("restoringSession")
    stop()
    recordBootPhase("sessionReady")
    assert.deepEqual(seen, ["rootLayout", "restoringSession"])
    assert.equal(getBootLogSnapshot().phase, "sessionReady")
    assert.equal(bootIsComplete("sessionReady"), true)
    assert.equal(bootIsComplete("jsStarted"), false)
  })

  it("stores fatal errors and can clear them", () => {
    recordBootError(new Error("boom"), true, "in Root")
    const snap = getBootLogSnapshot()
    assert.equal((snap.fatalError as Error).message, "boom")
    assert.equal(snap.lastError, snap.fatalError)
    assert.equal(snap.componentStack, "in Root")
    clearFatalError()
    assert.equal(getBootLogSnapshot().fatalError, null)
    assert.equal((getBootLogSnapshot().lastError as Error).message, "boom")
  })

  it("keeps an existing fatal error when a later non-fatal error is recorded", () => {
    recordBootError(new Error("fatal"), true)
    recordBootError(new Error("later"), false)
    assert.equal((getBootLogSnapshot().fatalError as Error).message, "fatal")
    assert.equal((getBootLogSnapshot().lastError as Error).message, "later")
  })

  it("formats Error, string, json, circular, and empty values", () => {
    const err = new Error("nope")
    assert.equal(formatUnknownError(err).message, "nope")
    assert.equal(formatUnknownError(err).stack, err.stack ?? "")
    const named = new Error("")
    named.name = "NamedError"
    assert.equal(formatUnknownError(named).message, "NamedError")
    assert.equal(formatUnknownError("plain").message, "plain")
    assert.equal(formatUnknownError("").message, "")
    assert.equal(formatUnknownError("   ").message, "")
    assert.equal(formatUnknownError({ code: 7 }).message, "{\"code\":7}")
    assert.equal(formatUnknownError(null).message, "null")
    assert.equal(formatUnknownError(undefined).message, "undefined")
    const circular: { self?: unknown } = {}
    circular.self = circular
    assert.equal(formatUnknownError(circular).message, "[object Object]")
  })

  it("keeps the stack from an Error instance", () => {
    const err = new Error("stacked")
    assert.match(formatUnknownError(err).stack, /stacked/)
  })

  it("maps boot phases to friendly locale strings", () => {
    const en = diagnosticMessages("en-CA")
    const es = getMobileMessages("es-ES")
    assert.equal(bootPhaseLabel(en, "jsStarted"), "JavaScript started")
    assert.equal(bootPhaseLabel(es, "restoringSession"), "Restaurando el inicio de sesión")
    assert.equal(isBootPhase("jsStarted"), true)
    assert.equal(isBootPhase("not-a-phase"), false)
  })

  it("treats boot-time failures as fatal until sign-in check finishes", () => {
    assert.equal(shouldTreatAsFatal(true, "sessionReady"), true)
    assert.equal(shouldTreatAsFatal(false, "sessionReady"), false)
    assert.equal(shouldTreatAsFatal(false, "restoringSession"), true)
  })

  it("uses a greppable log prefix", () => {
    assert.equal(BOOT_LOG_PREFIX, "MorphosCapture boot")
  })
})
