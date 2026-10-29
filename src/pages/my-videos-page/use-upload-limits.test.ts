// Окно «Лимиты загрузки»: остаток дневного лимита на сервере, куда пойдёт
// загрузка, ступень аккаунта, форматы и качество из настроек сервера.

import { describe, expect, it, vi } from 'vitest'

import {
  getInstanceUploadConfig,
  getUploadQuota,
  quotaTier,
} from '@/services/peertube/peertube-upload-limits'
import { useUploadLimits, type UploadLimitsDeps } from './use-upload-limits'

const HOST = 'peertube601.pocketnet.app'

function setup(deps: Partial<UploadLimitsDeps> = {}) {
  return useUploadLimits({
    deps: {
      resolveHost: vi.fn(async () => HOST),
      config: vi.fn(async () => ({ extensions: ['.mp4', '.mkv', '.mp3'], maxResolution: 480 })),
      quota: vi.fn(async () => ({ daily: 500_000_000, usedDaily: 120_000_000 })),
      token: vi.fn(async () => 'token'),
      ...deps,
    },
  })
}

describe('useUploadLimits', () => {
  it('остаток, доля потраченного и ступень аккаунта', async () => {
    const quota = vi.fn(async () => ({ daily: 500_000_000, usedDaily: 120_000_000 }))
    const limits = setup({ quota })
    await limits.load()
    expect(quota).toHaveBeenCalledWith(HOST, 'token')
    expect(limits.host.value).toBe(HOST)
    expect(limits.remaining.value).toBe(380_000_000)
    expect(limits.usedPercent.value).toBe(24)
    expect(limits.tier.value).toBe('reputation')
    expect(limits.videoFormats.value).toBe('MP4, MKV')
    expect(limits.audioFormats.value).toBe('MP3')
    expect(limits.maxResolution.value).toBe(480)
  })

  it('перебор — осталось ноль, а не минус', async () => {
    const limits = setup({ quota: async () => ({ daily: 250_000_000, usedDaily: 300_000_000 }) })
    await limits.load()
    expect(limits.remaining.value).toBe(0)
    expect(limits.usedPercent.value).toBe(100)
  })

  it('без ограничения сервер отдаёт -1', async () => {
    const limits = setup({ quota: async () => ({ daily: -1, usedDaily: 5 }) })
    await limits.load()
    expect(limits.unlimited.value).toBe(true)
    expect(limits.tier.value).toBeNull()
  })

  it('не вошёл — лимит не спрашиваем, форматы всё равно есть', async () => {
    const quota = vi.fn()
    const limits = setup({ token: null, quota })
    await limits.load()
    expect(quota).not.toHaveBeenCalled()
    expect(limits.quota.value).toBeNull()
    expect(limits.quotaFailed.value).toBe(false)
    expect(limits.videoFormats.value).toBe('MP4, MKV')
  })

  it('сервер не ответил про лимит — ошибка; про настройки — список по умолчанию', async () => {
    const limits = setup({
      quota: async () => {
        throw new Error('peertube_me_502')
      },
      config: async () => {
        throw new Error('peertube_config_502')
      },
    })
    await limits.load()
    expect(limits.quotaFailed.value).toBe(true)
    expect(limits.videoFormats.value).toContain('MP4')
    expect(limits.audioFormats.value).toContain('FLAC')
    expect(limits.maxResolution.value).toBeNull()
  })

  it('нода не дала сервер — ошибка; «Повторить» спрашивает снова', async () => {
    const resolveHost = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('peertube_no_host'))
      .mockResolvedValue(HOST)
    const limits = setup({ resolveHost })
    await limits.load()
    expect(limits.quotaFailed.value).toBe(true)
    await limits.load()
    expect(limits.quotaFailed.value).toBe(false)
    expect(limits.quota.value).not.toBeNull()
  })
})

describe('peertube-upload-limits', () => {
  const json = (body: unknown, ok = true) =>
    vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response)

  it('ступени — по лимиту сервера в десятичных байтах', () => {
    expect(quotaTier(250_000_000)).toBe('everyone')
    expect(quotaTier(2_000_000_000)).toBe('full')
    expect(quotaTier(5_000_000_000)).toBe('coins')
    expect(quotaTier(25_000_000_000)).toBeNull()
  })

  it('настройки: расширения и наибольшее качество, «0» — не качество', async () => {
    const fetchInstance = json({
      video: { file: { extensions: ['.mp4', '.webm', 7] } },
      transcoding: { enabledResolutions: [0, 144, 480] },
    })
    const config = await getInstanceUploadConfig(HOST, fetchInstance)
    expect(fetchInstance).toHaveBeenCalledWith('api/v1/config', expect.anything())
    expect(config).toEqual({ extensions: ['.mp4', '.webm'], maxResolution: 480 })
  })

  it('пустые настройки — список по умолчанию и качество неизвестно', async () => {
    const config = await getInstanceUploadConfig(HOST, json({}))
    expect(config.extensions).toContain('.mov')
    expect(config.maxResolution).toBeNull()
  })

  it('лимит: users/me и video-quota-used с токеном', async () => {
    const fetchInstance = vi.fn(async (path: string) => {
      const body =
        path === 'api/v1/users/me'
          ? { videoChannels: [{ id: 3 }], videoQuotaDaily: 2_000_000_000, videoQuota: -1 }
          : { videoQuotaUsedDaily: 700_000_000, videoQuotaUsed: 9 }
      return { ok: true, status: 200, json: async () => body } as Response
    })
    const quota = await getUploadQuota({ host: HOST, accessToken: 'abc', fetchInstance })
    expect(quota).toEqual({ daily: 2_000_000_000, usedDaily: 700_000_000 })
    for (const [, init] of fetchInstance.mock.calls as unknown as [string, RequestInit][]) {
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc')
    }
  })
})
