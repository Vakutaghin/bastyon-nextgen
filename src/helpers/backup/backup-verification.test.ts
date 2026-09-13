import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { memStorage } from '@/blockchain/storage/vault/test-mem-storage'
import {
  getBackupStatus,
  markBackupVerified,
  shouldNudgeBackup,
  markBackupNudged,
  pickChallengePositions,
  verifyWordChallenge,
  verifyKeyTail,
  STALE_AFTER_MS,
  NUDGE_INTERVAL_MS,
} from './backup-verification'

const A = 'PAddr'
const DAY = 24 * 60 * 60 * 1000

beforeEach(() => vi.stubGlobal('localStorage', memStorage()))
afterEach(() => vi.unstubAllGlobals())

describe('backup-verification: статус и напоминание (VP-8)', () => {
  it('never → ok после отметки → stale через 90 дней', () => {
    expect(getBackupStatus(A, 1000).state).toBe('never')
    markBackupVerified(A, 1000)
    expect(getBackupStatus(A, 1000 + DAY)).toEqual({ state: 'ok', verifiedAt: 1000 })
    expect(getBackupStatus(A, 1000 + STALE_AFTER_MS + 1).state).toBe('stale')
  })

  it('напоминаем не чаще раза в 7 дней и только пока бэкап не ok', () => {
    expect(shouldNudgeBackup(A, 1000)).toBe(true)
    markBackupNudged(1000)
    expect(shouldNudgeBackup(A, 1000 + DAY)).toBe(false)
    expect(shouldNudgeBackup(A, 1000 + NUDGE_INTERVAL_MS)).toBe(true)
    markBackupVerified(A, 1000 + NUDGE_INTERVAL_MS)
    expect(shouldNudgeBackup(A, 1000 + 2 * NUDGE_INTERVAL_MS)).toBe(false)
    expect(shouldNudgeBackup('', 5)).toBe(false)
  })

  it('мусор в хранилище = never', () => {
    localStorage.setItem('BST_BACKUP_VERIFIED_' + A, 'abc')
    expect(getBackupStatus(A).state).toBe('never')
  })
})

describe('backup-verification: челлендж (VP-7)', () => {
  const words = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima'.split(
    ' '
  )

  it('позиции различны, 1-based, по возрастанию, детерминированы rnd', () => {
    let i = 0
    const seq = [0.99, 0.0, 0.5]
    const pos = pickChallengePositions(12, 3, () => seq[i++ % seq.length]!)
    expect(pos).toEqual([1, 7, 12]) // 0.99→12, 0.0→1, 0.5 из оставшихся 2..11 → 7
    expect(new Set(pickChallengePositions(12, 12)).size).toBe(12)
    expect(pickChallengePositions(2, 3)).toHaveLength(2)
  })

  it('слова сверяются без учёта регистра и пробелов; любое несовпадение — отказ', () => {
    expect(verifyWordChallenge(words, [1, 6, 12], [' Alpha ', 'FOXTROT', 'lima'])).toBe(true)
    expect(verifyWordChallenge(words, [1, 6, 12], ['alpha', 'foxtrot', 'kilo'])).toBe(false)
    expect(verifyWordChallenge(words, [1, 6, 12], ['alpha', 'foxtrot'])).toBe(false)
    expect(verifyWordChallenge(words, [], [])).toBe(false)
    expect(verifyWordChallenge(words, [13], ['x'])).toBe(false)
  })

  it('хвост ключа: последние 6 символов без учёта регистра', () => {
    expect(verifyKeyTail('ABCDEF0123456789', '456789')).toBe(true)
    expect(verifyKeyTail('abcdef0123456789', ' 456789 ')).toBe(true)
    expect(verifyKeyTail('abcdef0123456789', '45678')).toBe(false)
    expect(verifyKeyTail('abc', 'abc')).toBe(false)
  })
})
