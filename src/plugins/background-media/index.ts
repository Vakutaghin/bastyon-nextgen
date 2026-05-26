import { registerPlugin } from '@capacitor/core'

import type { BackgroundMediaPlugin } from './types'

export * from './types'

const webFallback: BackgroundMediaPlugin = {
  start: async () => {},
  update: async () => {},
  stop: async () => {},
  isSupported: async () => ({ supported: false }),
  addListener: async () => ({ remove: async () => {} }) as any,
}

export const BackgroundMedia = registerPlugin<BackgroundMediaPlugin>('BackgroundMedia', {
  web: () => webFallback,
})
