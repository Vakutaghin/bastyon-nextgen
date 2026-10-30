// Настройка приватности с сервера и с устройства: чужие поля и типы не
// проходят, недостающее — по умолчанию (как было до настройки).

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_CHAT_PRIVACY,
  parseRecordingSignal,
  sameChatPrivacy,
  sanitizeChatPrivacy,
} from './chat-privacy'

describe('sanitizeChatPrivacy', () => {
  it('по умолчанию «в сети» не сообщаем, «печатает» и «записывает» — да', () => {
    expect(sanitizeChatPrivacy(null)).toEqual({ online: false, typing: true, recording: true })
    expect(DEFAULT_CHAT_PRIVACY.online).toBe(false)
  })

  it('берёт только булевы поля, остальное — по умолчанию', () => {
    expect(sanitizeChatPrivacy({ online: true, typing: 'no', extra: 1 })).toEqual({
      online: true,
      typing: true,
      recording: true,
    })
    expect(sanitizeChatPrivacy({ typing: false, recording: false })).toEqual({
      online: false,
      typing: false,
      recording: false,
    })
  })

  it('sameChatPrivacy сравнивает все три', () => {
    expect(sameChatPrivacy(DEFAULT_CHAT_PRIVACY, { ...DEFAULT_CHAT_PRIVACY })).toBe(true)
    expect(
      sameChatPrivacy(DEFAULT_CHAT_PRIVACY, { ...DEFAULT_CHAT_PRIVACY, recording: false })
    ).toBe(false)
  })
})

describe('parseRecordingSignal', () => {
  it('комната Matrix и флаг — иначе не сигнал', () => {
    expect(parseRecordingSignal({ room_id: '!r:x', recording: true })).toEqual({
      roomId: '!r:x',
      recording: true,
    })
    expect(parseRecordingSignal({ room_id: 'mesh:1', recording: true })).toBeNull()
    expect(parseRecordingSignal({ room_id: '!r:x', recording: 'yes' })).toBeNull()
    expect(parseRecordingSignal(null)).toBeNull()
  })
})
