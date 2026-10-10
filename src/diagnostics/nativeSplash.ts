type SplashModule = {
  preventAutoHideAsync: () => Promise<unknown>
  hideAsync: () => Promise<unknown>
}

export type SplashLoader = () => SplashModule | null

const defaultLoader: SplashLoader = () => {
  try {
    const BootSplash = require("react-native-bootsplash") as {
      hide: (opts?: { fade?: boolean }) => Promise<unknown>
    }
    return {
      preventAutoHideAsync: async () => true,
      hideAsync: () => BootSplash.hide({ fade: true }),
    }
  } catch {
    return {
      preventAutoHideAsync: async () => false,
      hideAsync: async () => false,
    }
  }
}

let loadSplash: SplashLoader = defaultLoader

export function setSplashLoaderForTests(loader: SplashLoader | null): void {
  loadSplash = loader ?? defaultLoader
}

export async function preventAutoHideSplash(loader: SplashLoader = loadSplash): Promise<boolean> {
  try {
    const splash = loader()
    if (!splash) return false
    await splash.preventAutoHideAsync()
    return true
  } catch {
    return false
  }
}

export async function hideNativeSplash(loader: SplashLoader = loadSplash): Promise<boolean> {
  try {
    const splash = loader()
    if (!splash) return false
    await splash.hideAsync()
    return true
  } catch {
    return false
  }
}
