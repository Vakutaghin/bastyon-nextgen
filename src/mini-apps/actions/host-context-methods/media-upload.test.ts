import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createMediaUploadMethods, type MediaUploadDeps } from './media-upload'

const keyPair = { privateKey: 'k' } as never

function make(over: Partial<MediaUploadDeps> = {}) {
  const deps: MediaUploadDeps = {
    useAuthStore: (() => ({ getKeyPair: keyPair, address: 'PADDR' })) as never,
    uploadImages: vi.fn(async (imgs: string[]) => imgs.map((_, i) => `u${i}`)),
    removeVideoByPointer: vi.fn(async () => ({ ok: true }) as never),
    parsePointer: (url: string) => {
      const m = /^peertube:\/\/([^/]+)\/([^/]+)/.exec(url)
      return m ? ({ host: m[1]!, videoId: m[2]!, type: 'video' } as never) : null
    },
    fetchHostAllowlist: vi.fn(async () => new Set(['good.host'])),
    confirmRemoval: vi.fn(async () => true),
    ...over,
  }
  return { api: createMediaUploadMethods(deps), deps }
}

beforeEach(() => vi.clearAllMocks())

describe('removeVideo (K2)', () => {
  it('известный хост + подтверждение → DELETE с ключами пользователя', async () => {
    const { api, deps } = make()
    await api.removeVideo('peertube://Good.Host/VID', { appName: 'App' })
    expect(deps.confirmRemoval).toHaveBeenCalledWith({
      appName: 'App',
      host: 'good.host',
      videoId: 'VID',
    })
    expect(deps.removeVideoByPointer).toHaveBeenCalledWith({
      pointer: 'peertube://Good.Host/VID',
      keyPair,
      address: 'PADDR',
    })
  })

  it('чужой хост: ни подписи, ни диалога', async () => {
    const { api, deps } = make()
    await expect(api.removeVideo('peertube://evil.example/x', { appName: 'App' })).rejects.toThrow(
      'videos:remove:host_not_allowed'
    )
    expect(deps.confirmRemoval).not.toHaveBeenCalled()
    expect(deps.removeVideoByPointer).not.toHaveBeenCalled()
  })

  it('нода не отдала список → fail-closed', async () => {
    const { api, deps } = make({
      fetchHostAllowlist: vi.fn(async () => {
        throw new Error('net')
      }),
    })
    await expect(api.removeVideo('peertube://good.host/VID', { appName: 'App' })).rejects.toThrow(
      'videos:remove:hosts_unavailable'
    )
    expect(deps.removeVideoByPointer).not.toHaveBeenCalled()
  })

  it('пользователь отказал → ничего не удаляется', async () => {
    const { api, deps } = make({ confirmRemoval: vi.fn(async () => false) })
    await expect(api.removeVideo('peertube://good.host/VID', { appName: 'App' })).rejects.toThrow(
      'videos:remove:denied'
    )
    expect(deps.removeVideoByPointer).not.toHaveBeenCalled()
  })

  it('битый указатель → peertube_pointer_invalid до любых запросов', async () => {
    const { api, deps } = make()
    await expect(api.removeVideo('nope', { appName: 'App' })).rejects.toThrow(
      'peertube_pointer_invalid'
    )
    expect(deps.fetchHostAllowlist).not.toHaveBeenCalled()
  })
})
