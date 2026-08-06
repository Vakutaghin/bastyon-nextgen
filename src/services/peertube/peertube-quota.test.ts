import { describe, it, expect, vi } from 'vitest'
import {
  evaluateQuota,
  fetchDailyQuotaUsed,
  checkDailyQuota,
  QuotaExceededError,
} from './peertube-quota'
import type { InstanceFetch } from './peertube-instance'

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('evaluateQuota', () => {
  it('помещается в дневную квоту → allowed', () => {
    const r = evaluateQuota({
      size: 100,
      videoQuotaDaily: 1000,
      videoQuotaUsedDaily: 200,
      videoQuota: 5000,
    })
    expect(r.allowed).toBe(true)
    expect(r.remainingDaily).toBe(800)
    expect(r.unlimited).toBe(false)
  })

  it('перебор дневной квоты → blocked', () => {
    const r = evaluateQuota({
      size: 900,
      videoQuotaDaily: 1000,
      videoQuotaUsedDaily: 200,
      videoQuota: 5000,
    })
    // 900 + 200 = 1100 >= 1000
    expect(r.allowed).toBe(false)
  })

  it('безлимитная дневная квота (daily < 0) → allowed', () => {
    const r = evaluateQuota({
      size: 10 ** 9,
      videoQuotaDaily: -1,
      videoQuotaUsedDaily: 10 ** 9,
      videoQuota: -1,
    })
    expect(r.allowed).toBe(true)
    expect(r.unlimited).toBe(true)
  })

  it('нет размера/квоты → allowed (доверяем серверу)', () => {
    expect(
      evaluateQuota({ size: 0, videoQuotaDaily: 1000, videoQuotaUsedDaily: 0, videoQuota: 1 })
        .allowed
    ).toBe(true)
    expect(
      evaluateQuota({ size: 100, videoQuotaDaily: 0, videoQuotaUsedDaily: 0, videoQuota: 1 })
        .allowed
    ).toBe(true)
    expect(
      evaluateQuota({ size: 100, videoQuotaDaily: 1000, videoQuotaUsedDaily: 0, videoQuota: 0 })
        .allowed
    ).toBe(true)
  })
})

describe('fetchDailyQuotaUsed', () => {
  it('парсит videoQuotaUsedDaily/videoQuotaUsed + шлёт Bearer', async () => {
    const fetchInstance = vi.fn(async () =>
      jsonRes({ videoQuotaUsedDaily: 123, videoQuotaUsed: 456 })
    ) as unknown as InstanceFetch & { mock: { calls: unknown[][] } }

    const r = await fetchDailyQuotaUsed({ host: 'h', accessToken: 'AT', fetchInstance })
    expect(r).toEqual({ videoQuotaUsedDaily: 123, videoQuotaUsed: 456 })

    const call = fetchInstance.mock.calls[0]
    expect(call?.[0]).toBe('api/v1/users/me/video-quota-used')
    const headers = (call?.[1] as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer AT')
  })

  it('нет videoQuotaUsedDaily → invalid', async () => {
    const fetchInstance = (async () => jsonRes({})) as InstanceFetch
    await expect(
      fetchDailyQuotaUsed({ host: 'h', accessToken: 'AT', fetchInstance })
    ).rejects.toThrow('peertube_quota_used_invalid')
  })

  it('не-ok статус → ошибка с кодом', async () => {
    const fetchInstance = (async () => jsonRes({}, 500)) as InstanceFetch
    await expect(
      fetchDailyQuotaUsed({ host: 'h', accessToken: 'AT', fetchInstance })
    ).rejects.toThrow('peertube_quota_used_500')
  })
})

describe('checkDailyQuota', () => {
  it('в пределах квоты → возвращает evaluation', async () => {
    const fetchInstance = (async () =>
      jsonRes({ videoQuotaUsedDaily: 100, videoQuotaUsed: 100 })) as InstanceFetch
    const r = await checkDailyQuota({
      size: 500,
      videoQuotaDaily: 1000,
      videoQuota: 5000,
      host: 'h',
      accessToken: 'AT',
      fetchInstance,
    })
    expect(r.allowed).toBe(true)
    expect(r.remainingDaily).toBe(900)
  })

  it('перебор → QuotaExceededError с остатком', async () => {
    const fetchInstance = (async () =>
      jsonRes({ videoQuotaUsedDaily: 900, videoQuotaUsed: 900 })) as InstanceFetch
    await expect(
      checkDailyQuota({
        size: 500,
        videoQuotaDaily: 1000,
        videoQuota: 5000,
        host: 'h',
        accessToken: 'AT',
        fetchInstance,
      })
    ).rejects.toBeInstanceOf(QuotaExceededError)
  })
})
