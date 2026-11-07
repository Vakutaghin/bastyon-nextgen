import { describe, it, expect, vi } from 'vitest'
import {
  COMPLAINT_ENDPOINT,
  ComplaintNotSentError,
  complaintEntity,
  complaintRecord,
  sendMiniAppComplaint,
} from './miniapp-complaint'

const entity = {
  link: '/application?id=barteron.pocketnet.app&p=6261',
  txid: 'a'.repeat(64),
  type: 'offer',
}
const input = { entity, reason: 6 as const, language: 'ru', appVersion: '0.29.1' }
const NOW = new Date(2026, 10, 7, 21, 5, 9)

describe('complaintRecord', () => {
  it('запись в формате прежнего клиента: значения в кавычках через запятую', () => {
    expect(complaintRecord(input, NOW, 'abc123')).toBe(
      `('MINIAPP_COMPLAIN','{"link":"/application?id=barteron.pocketnet.app&p=6261","txid":"${'a'.repeat(64)}","type":"offer"}','Spam','2026-11-07 21:05:09','0.0.1','Bastyon NextGen 0.29.1','abc123','ru')`
    )
  })

  it('кавычки, обратная косая и переводы строк из значений убираются', () => {
    const record = complaintRecord(
      { ...input, entity: { ...entity, link: "/x'),('DROP\\\n" } },
      NOW,
      'id'
    )
    expect(record).toContain('"link":"/x),(DROP"')
    expect(record.match(/'/g)).toHaveLength(16)
  })
})

describe('complaintEntity', () => {
  it('из полей SDK Barteron', () => {
    expect(
      complaintEntity({ entityLink: entity.link, entityTxid: entity.txid, entityType: 'offer' })
    ).toEqual(entity)
  })

  it('без ссылки и txid или слишком длинное — null', () => {
    expect(complaintEntity({ entityType: 'offer' })).toBeNull()
    expect(complaintEntity({ entityLink: 'x'.repeat(513) })).toBeNull()
    expect(complaintEntity(null)).toBeNull()
  })
})

describe('sendMiniAppComplaint', () => {
  it('одна запись POST text/plain на сервер Pocketnet, без адреса пользователя', async () => {
    const fetch = vi.fn(async () => new Response('', { status: 200 }))
    await sendMiniAppComplaint(input, { fetch, now: () => NOW, randomId: () => 'r1' })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(COMPLAINT_ENDPOINT)
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'text/plain' })
    expect(init.body).toBe(complaintRecord(input, NOW, 'r1'))
  })

  it('сервер не ответил или ответил ошибкой — ComplaintNotSentError', async () => {
    await expect(
      sendMiniAppComplaint(input, {
        fetch: vi.fn(async () => {
          throw new TypeError('Failed to fetch')
        }),
      })
    ).rejects.toBeInstanceOf(ComplaintNotSentError)
    await expect(
      sendMiniAppComplaint(input, { fetch: vi.fn(async () => new Response('', { status: 502 })) })
    ).rejects.toBeInstanceOf(ComplaintNotSentError)
  })
})
