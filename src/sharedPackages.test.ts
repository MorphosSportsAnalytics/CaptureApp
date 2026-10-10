import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { createRequire } from "node:module"
import { describe, it, after } from "node:test"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const shared = require("../scripts/shared-packages.cjs") as {
  SHARED_PACKAGE_NAMES: string[]
  packagesDir: (appRoot: string) => string
  metroWatchFolders: (appRoot: string) => string[]
  metroExtraNodeModules: (appRoot: string) => Record<string, string>
  missingSharedPackages: (packagesRoot: string, io: { existsSync: (p: string) => boolean }) => string[]
  packageHasDist: (packageDir: string, io: { existsSync: (p: string) => boolean }) => boolean
}

const tmpRoots: string[] = []

function tmpDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "capture-shared-pkg-"))
  tmpRoots.push(dir)
  return dir
}

after(() => {
  for (const dir of tmpRoots) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe("shared packages layout", () => {
  it("does not vendor entra-auth", () => {
    assert.deepEqual(shared.SHARED_PACKAGE_NAMES, ["mobile-i18n", "mobile-preprocess", "portal-api-client"])
    assert.ok(!shared.SHARED_PACKAGE_NAMES.includes("entra-auth"))
  })

  it("resolves committed ./packages next to the app", () => {
    const appRoot = tmpDir()
    assert.equal(shared.packagesDir(appRoot), path.join(appRoot, "packages"))
  })

  it("points Metro at ./packages and each @morphos module", () => {
    const appRoot = tmpDir()
    const folders = shared.metroWatchFolders(appRoot)
    assert.deepEqual(folders, [path.join(appRoot, "packages")])
    const extra = shared.metroExtraNodeModules(appRoot)
    assert.equal(extra["@morphos/mobile-i18n"], path.join(appRoot, "packages", "mobile-i18n"))
    assert.equal(extra["@morphos/mobile-preprocess"], path.join(appRoot, "packages", "mobile-preprocess"))
    assert.equal(extra["@morphos/portal-api-client"], path.join(appRoot, "packages", "portal-api-client"))
    assert.equal(extra["@morphos/entra-auth"], undefined)
  })

  it("reports missing package.json files", () => {
    const root = tmpDir()
    mkdirSync(path.join(root, "mobile-i18n"), { recursive: true })
    writeFileSync(path.join(root, "mobile-i18n", "package.json"), "{}")
    assert.deepEqual(shared.missingSharedPackages(root, { existsSync: require("node:fs").existsSync }), [
      "mobile-preprocess",
      "portal-api-client",
    ])
  })

  it("detects dist/index.js", () => {
    const dir = tmpDir()
    assert.equal(shared.packageHasDist(dir, { existsSync: () => false }), false)
    assert.equal(
      shared.packageHasDist(dir, { existsSync: (p: string) => p === path.join(dir, "dist", "index.js") }),
      true,
    )
  })

  it("repo packages/VENDOR.md forbids entra-auth", () => {
    const vendorMd = fileURLToPath(new URL("../packages/VENDOR.md", import.meta.url))
    const body = require("node:fs").readFileSync(vendorMd, "utf8")
    assert.match(body, /@morphos\/entra-auth/)
    assert.match(body, /is not here/)
    assert.match(body, /x-morphos-portal-user-bearer/)
    assert.match(body, /x-morphos-upload-ticket/)
  })
})
