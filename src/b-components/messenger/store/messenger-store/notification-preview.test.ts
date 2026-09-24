// S41: системное уведомление показывает понятный текст и имя, а не шифротекст
// и hex-локалпарт matrix-id.

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/i18n', () => ({ t: (k: string) => k }))

import { notificationPreviewFor, senderDisplayName, looksEncrypted } from './notification-preview'

const event = (content: Record<string, unknown>, type = 'm.room.message') => ({
  getContent: () => content,
  getType: () => type,
})

describe('notificationPreviewFor (S41)', () => {
  it('never shows the ciphertext body', () => {
    const cipher = 'eyJAMzQ1OiI6eyJlbmNyeXB0ZWQiOiJhYmNkZWZnaGlqa2xtbm9w'
    expect(notificationPreviewFor(event({ msgtype: 'm.text', body: cipher }))).toBe(
      'messenger.notifyEncrypted'
    )
    expect(notificationPreviewFor(event({ body: 'deadbeef'.repeat(8) }))).toBe(
      'messenger.notifyEncrypted'
    )
  })

  it('names the attachment kind', () => {
    expect(notificationPreviewFor(event({ msgtype: 'm.image', body: 'x' }))).toBe(
      'messenger.notifyImage'
    )
    expect(notificationPreviewFor(event({ msgtype: 'm.audio', body: 'x' }))).toBe(
      'messenger.notifyAudio'
    )
    expect(notificationPreviewFor(event({ msgtype: 'm.file', body: 'x' }))).toBe(
      'messenger.notifyFile'
    )
  })

  it('passes a readable text through', () => {
    expect(notificationPreviewFor(event({ msgtype: 'm.text', body: 'привет, как дела?' }))).toBe(
      'привет, как дела?'
    )
  })

  it('treats an encrypted event type as encrypted whatever the body', () => {
    expect(notificationPreviewFor(event({ body: 'hi' }, 'm.room.encrypted'))).toBe(
      'messenger.notifyEncrypted'
    )
  })
})

describe('looksEncrypted', () => {
  it('does not mistake ordinary words for ciphertext', () => {
    expect(looksEncrypted('hello')).toBe(false)
    expect(looksEncrypted('a sentence with spaces that is quite long indeed')).toBe(false)
    expect(looksEncrypted(undefined)).toBe(false)
  })
})

describe('senderDisplayName (S41)', () => {
  it('prefers the Bastyon profile name', () => {
    expect(
      senderDisplayName({ profileName: 'Alice', roomMemberName: '3f2a…', address: 'PA' })
    ).toBe('Alice')
  })

  it('skips a hex room-member name and falls back to the address', () => {
    expect(senderDisplayName({ roomMemberName: '3f2a9b8c7d6e5f40', address: 'PAddress' })).toBe(
      'PAddress'
    )
  })

  it('keeps a human room-member name', () => {
    expect(senderDisplayName({ roomMemberName: 'Bob', address: 'PB' })).toBe('Bob')
  })
})
