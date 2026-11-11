import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createMediaUploadMethods, type MediaUploadDeps } from './media-upload'

const keyPair = { privateKey: 'k' } as never

function make(over: Partial<MediaUploadDeps> = {}) {
  const deps: MediaUploadDeps = {
    useAuthStore: (() => ({ getKeyPair: keyPair, address: 'PADDR' })) as never,
    uploadImages: vi.fn(async (imgs: string[]) => imgs.map((_, i) => `u${i}`)),
    resizeImage: vi.fn(async (img: string) => `${img}#small`),
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

describe('uploadImages', () => {
  it('картинки вписываются в 1080×1080 до загрузки, порядок тот же', async () => {
    const { api, deps } = make()
    const urls = await api.uploadImages(['data:image/jpeg;base64,AA', 'data:image/png;base64,BB'])
    expect(urls).toEqual(['u0', 'u1'])
    expect(deps.resizeImage).toHaveBeenCalledWith('data:image/jpeg;base64,AA', {
      maxWidth: 1080,
      maxHeight: 1080,
    })
    expect(deps.uploadImages).toHaveBeenCalledWith([
      'data:image/jpeg;base64,AA#small',
      'data:image/png;base64,BB#small',
    ])
  })

  it('готовый адрес — без ресайза', async () => {
    const { api, deps } = make()
    await api.uploadImages(['https://cdn/x.jpg'])
    expect(deps.resizeImage).not.toHaveBeenCalled()
    expect(deps.uploadImages).toHaveBeenCalledWith(['https://cdn/x.jpg'])
  })

  it('окно картинку не декодирует — уходит как есть, остальные уменьшены', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const resizeImage = vi.fn(async (img: string) => {
      if (img.includes('heic')) throw new Error('Failed to load image for resize')
      return `${img}#small`
    })
    const { api, deps } = make({ resizeImage })
    await api.uploadImages(['data:image/heic;base64,AA', 'data:image/jpeg;base64,BB'])
    expect(deps.uploadImages).toHaveBeenCalledWith([
      'data:image/heic;base64,AA',
      'data:image/jpeg;base64,BB#small',
    ])
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})

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
