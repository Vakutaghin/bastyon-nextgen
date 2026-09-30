import { describe, expect, it } from 'vitest'

import { t } from '@/i18n'
import { NodeRejectError, toNodeRejectError } from './node-reject'

describe('toNodeRejectError', () => {
  it.each([
    [2, 'postLimit'],
    [3, 'scoreLimit'],
    [15, 'reportLimit'],
    [29, 'commentLimit'],
    [31, 'commentScoreLimit'],
    [49, 'settingsLimit'],
    [61, 'editOncePerBlock'],
    [18, 'nameTaken'],
    [313, 'accountLocked'],
  ])('код %i — свой текст (%s)', (code, key) => {
    const err = toNodeRejectError({ code, message: 'Failed SocialConsensusHelper::Validate' })
    expect(err).toBeInstanceOf(NodeRejectError)
    expect(err?.code).toBe(code)
    expect(err?.message).toBe(t(`nodeReject.${key}`))
    expect(err?.message).not.toContain('nodeReject.')
  })

  it('код во вложенном error, в cause или строкой', () => {
    expect(toNodeRejectError({ error: { code: 29 } })?.message).toBe(t('nodeReject.commentLimit'))
    const wrapped = new Error('Failed to send transaction', { cause: { code: 31 } })
    expect(toNodeRejectError(wrapped)?.code).toBe(31)
    expect(toNodeRejectError({ code: '15' })?.message).toBe(t('nodeReject.reportLimit'))
  })

  it('новый код консенсуса — общий текст с номером', () => {
    const err = toNodeRejectError({ code: 63 })
    expect(err?.message).toBe(t('nodeReject.unknownCode', { code: 63 }))
    expect(err?.message).toContain('63')
  })

  it('действие с удалённым постом (комментарий, репост, жалоба, оценка, буст) — «Пост удалён»', () => {
    for (const code of [51, 52, 56, 57]) {
      expect(toNodeRejectError({ code })?.message).toBe(t('nodeReject.contentDeleted'))
    }
  })

  it('коды прокси (408, 2000) и сетевые ошибки — не отказ ноды', () => {
    expect(toNodeRejectError({ code: 408 })).toBeNull()
    expect(toNodeRejectError({ code: 2000 })).toBeNull()
    expect(toNodeRejectError(new Error('RPC request timeout after 90000ms'))).toBeNull()
    expect(toNodeRejectError('ECONNRESET')).toBeNull()
    expect(toNodeRejectError(null)).toBeNull()
  })

  it('отказ mempool: конфликт входов лечится ожиданием, остальное — с причиной ноды', () => {
    expect(
      toNodeRejectError({ code: -26, message: 'txn-mempool-conflict (code 18)' })?.message
    ).toBe(t('nodeReject.waitPrevious'))
    expect(
      toNodeRejectError({ code: -25, message: 'bad-txns-inputs-missingorspent' })?.message
    ).toBe(t('nodeReject.waitPrevious'))
    expect(toNodeRejectError({ code: -26, message: 'min relay fee not met' })?.message).toBe(
      t('nodeReject.rejected', { reason: 'min relay fee not met' })
    )
    expect(toNodeRejectError({ code: -25, message: 'bad tx' })).toBeNull()
    expect(toNodeRejectError({ code: -8, message: 'Invalid parameter' })).toBeNull()
  })

  it('уже готовый NodeRejectError возвращается как есть', () => {
    const err = new NodeRejectError(4, 'text')
    expect(toNodeRejectError(err)).toBe(err)
  })
})
