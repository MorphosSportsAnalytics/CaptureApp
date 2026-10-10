"use strict"

const fs = require("fs")
const path = require("path")
const { spawnSync } = require("child_process")

/** Packages committed under ./packages (no Morphos sibling, no entra-auth). */
const SHARED_PACKAGE_NAMES = ["mobile-i18n", "mobile-preprocess", "portal-api-client"]

function defaultIo() {
  return {
    existsSync: fs.existsSync,
    readFileSync: fs.readFileSync,
    spawnSync,
    log: console.log,
    error: console.error,
    exit: process.exit,
  }
}

function packagesDir(appRoot) {
  return path.join(appRoot, "packages")
}

function metroWatchFolders(appRoot) {
  return [packagesDir(appRoot)]
}

function metroExtraNodeModules(appRoot) {
  const root = packagesDir(appRoot)
  return Object.fromEntries(SHARED_PACKAGE_NAMES.map((name) => [`@morphos/${name}`, path.join(root, name)]))
}

function missingSharedPackages(packagesRoot, ioIn) {
  const io = { ...defaultIo(), ...ioIn }
  return SHARED_PACKAGE_NAMES.filter((name) => !io.existsSync(path.join(packagesRoot, name, "package.json")))
}

function packageHasDist(packageDir, io) {
  return io.existsSync(path.join(packageDir, "dist", "index.js"))
}

function runNpm(io, args, cwd) {
  const result = io.spawnSync("npm", args, { cwd, encoding: "utf8", stdio: "pipe" })
  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join("\n").trim()
    throw new Error(`npm ${args.join(" ")} failed in ${cwd}${detail ? `\n${detail}` : ""}`)
  }
  return result
}

function ensurePackageBuilt(packageDir, ioIn) {
  const io = { ...defaultIo(), ...ioIn }
  if (packageHasDist(packageDir, io)) {
    return { built: false }
  }
  runNpm(io, ["install"], packageDir)
  runNpm(io, ["run", "build"], packageDir)
  return { built: true }
}

function main(argv, ioIn) {
  const io = { ...defaultIo(), ...ioIn }
  io.error("Usage: shared packages live in ./packages. Metro reads them via metro.config.js.")
  io.exit(1)
  return 1
}

module.exports = {
  SHARED_PACKAGE_NAMES,
  packagesDir,
  metroWatchFolders,
  metroExtraNodeModules,
  missingSharedPackages,
  packageHasDist,
  ensurePackageBuilt,
  main,
}

if (require.main === module) {
  main(process.argv)
}
