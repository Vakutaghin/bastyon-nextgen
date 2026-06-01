import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'

import type { BackgroundMediaPlugin } from './types'

export * from './types'

const webFallback: BackgroundMediaPlugin = {
  start: async () => {},
  update: async () => {},
  stop: async () => {},
  isSupported: async () => ({ supported: false }),
  addListener: async (): Promise<PluginListenerHandle> => ({ remove: async () => {} }),
}

export const BackgroundMedia = registerPlugin<BackgroundMediaPlugin>('BackgroundMedia', {
  web: () => webFallback,
})
