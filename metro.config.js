const path = require("path")
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config")
const { metroExtraNodeModules, metroWatchFolders } = require("./scripts/shared-packages.cjs")

const projectRoot = __dirname
const srcRoot = path.resolve(projectRoot, "src")

const config = {
  watchFolders: metroWatchFolders(projectRoot),
  resolver: {
    nodeModulesPaths: [path.resolve(projectRoot, "node_modules")],
    extraNodeModules: metroExtraNodeModules(projectRoot),
    unstable_enablePackageExports: true,
    resolveRequest(context, moduleName, platform) {
      if (moduleName.startsWith("@/")) {
        return context.resolveRequest(context, path.join(srcRoot, moduleName.slice(2)), platform)
      }
      return context.resolveRequest(context, moduleName, platform)
    },
  },
}

module.exports = mergeConfig(getDefaultConfig(projectRoot), config)
