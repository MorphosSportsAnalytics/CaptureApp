import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { hideNativeSplash, preventAutoHideSplash, setSplashLoaderForTests } from "./nativeSplash.js"

afterEach(() => {
  setSplashLoaderForTests(null)
})

describe("nativeSplash", () => {
  it("prevents auto-hide and hides when the native module is present", async () => {
    const calls: string[] = []
    setSplashLoaderForTests(() => ({
      preventAutoHideAsync: async () => {
        calls.push("prevent")
      },
      hideAsync: async () => {
        calls.push("hide")
      },
    }))
    assert.equal(await preventAutoHideSplash(), true)
    assert.equal(await hideNativeSplash(), true)
    assert.deepEqual(calls, ["prevent", "hide"])
  })

  it("returns false when the native module is missing", async () => {
    setSplashLoaderForTests(() => null)
    assert.equal(await preventAutoHideSplash(), false)
    assert.equal(await hideNativeSplash(), false)
  })

  it("returns false when splash methods throw", async () => {
    setSplashLoaderForTests(() => ({
      preventAutoHideAsync: async () => {
        throw new Error("too late")
      },
      hideAsync: async () => {
        throw new Error("already gone")
      },
    }))
    assert.equal(await preventAutoHideSplash(), false)
    assert.equal(await hideNativeSplash(), false)
  })

  it("accepts an explicit loader argument", async () => {
    assert.equal(await preventAutoHideSplash(() => null), false)
    assert.equal(
      await hideNativeSplash(() => ({
        preventAutoHideAsync: async () => {},
        hideAsync: async () => {},
      })),
      true,
    )
  })
})
