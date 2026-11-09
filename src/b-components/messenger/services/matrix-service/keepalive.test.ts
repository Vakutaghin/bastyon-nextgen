// Пинг Matrix-сессии: не без сети и не в свёрнутом мобильном приложении —
// синк и так ходит с тем же токеном, а пинг лишь будит радио.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Capacitor } from '@capacitor/core'
import type { MatrixClient } from 'matrix-js-sdk'

import { resetAppForegroundForTests, setAppActiveForTests } from '@/helpers/common/app-foreground'
import { runKeepAlive } from './keepalive'

function client() {
  const whoami = vi.fn(async () => ({ user_id: '@a:srv' }))
  return { whoami, sdk: { whoami } as unknown as MatrixClient }
}

describe('runKeepAlive', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    resetAppForegroundForTests()
  })

  it('свёрнутое мобильное приложение не пингует; компьютер и браузер — пингуют и в фоне', async () => {
    const c = client()
    setAppActiveForTests(false)
    await runKeepAlive(c.sdk)
    expect(c.whoami).toHaveBeenCalledTimes(1)

    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    await runKeepAlive(c.sdk)
    expect(c.whoami).toHaveBeenCalledTimes(1)

    setAppActiveForTests(true)
    await runKeepAlive(c.sdk)
    expect(c.whoami).toHaveBeenCalledTimes(2)
  })
})
