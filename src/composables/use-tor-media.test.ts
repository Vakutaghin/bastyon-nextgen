import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import { useTorStore } from '@/stores/tor-store'
import { useTorMedia } from './use-tor-media'

describe('useTorMedia', () => {
  it('mediaBlocked = wantsTor (включён в десктопе), даже пока Tor не ready', () => {
    setActivePinia(createPinia())
    const tor = useTorStore()
    const { mediaBlocked } = useTorMedia()
    expect(mediaBlocked.value).toBe(false)
    tor.available = true
    tor.enabled = true
    tor.status = 'bootstrapping'
    expect(mediaBlocked.value).toBe(true)
    tor.enabled = false
    expect(mediaBlocked.value).toBe(false)
  })

  it('без pinia — всегда false', () => {
    setActivePinia(undefined as unknown as ReturnType<typeof createPinia>)
    expect(useTorMedia().mediaBlocked.value).toBe(false)
  })
})
