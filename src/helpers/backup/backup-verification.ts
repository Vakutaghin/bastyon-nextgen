// Проверка резервной копии (12 слов / приватный ключ) — аудит VP-7/VP-8.
//
// Сейф сида passwordless: доступ к аккаунту на устройстве зависит от device-ключа
// в хранилище браузера/приложения. Единственный настоящий бэкап — секретная
// фраза. Здесь: (1) челлендж «введите слова №N» вместо галочки «я записал»,
// (2) отметка «проверено» per-адрес и (3) ненавязчивое повторяющееся
// напоминание, пока бэкап не проверен или проверка устарела.
// framework-free: никакого Vue/Pinia, только localStorage.

import { BACKUP_VERIFIED_PREFIX, BACKUP_NUDGED_AT_KEY } from '@/blockchain/constants/storage'

export const STALE_AFTER_MS = 90 * 24 * 60 * 60 * 1000
export const NUDGE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000
/** Сколько слов спрашиваем из 12 (как у аппаратных кошельков). */
export const CHALLENGE_WORDS = 3
/** Для аккаунтов по приватному ключу — сколько последних символов просим ввести. */
export const KEY_TAIL_CHARS = 6

export type BackupState = 'never' | 'stale' | 'ok'

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

function readTs(key: string): number | null {
  const raw = storage()?.getItem(key)
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function getBackupStatus(
  address: string,
  now: number = Date.now()
): { state: BackupState; verifiedAt: number | null } {
  const verifiedAt = address ? readTs(BACKUP_VERIFIED_PREFIX + address) : null
  if (!verifiedAt) return { state: 'never', verifiedAt: null }
  return { state: now - verifiedAt > STALE_AFTER_MS ? 'stale' : 'ok', verifiedAt }
}

export function markBackupVerified(address: string, now: number = Date.now()): void {
  if (!address) return
  try {
    storage()?.setItem(BACKUP_VERIFIED_PREFIX + address, String(now))
  } catch {
    /* best-effort */
  }
}

/** Пора ли напомнить: бэкап не ok и с прошлого напоминания прошло ≥ NUDGE_INTERVAL_MS. */
export function shouldNudgeBackup(address: string, now: number = Date.now()): boolean {
  if (!address) return false
  if (getBackupStatus(address, now).state === 'ok') return false
  const last = readTs(BACKUP_NUDGED_AT_KEY)
  return !last || now - last >= NUDGE_INTERVAL_MS
}

export function markBackupNudged(now: number = Date.now()): void {
  try {
    storage()?.setItem(BACKUP_NUDGED_AT_KEY, String(now))
  } catch {
    /* best-effort */
  }
}

/** Случайные различные позиции слов (1-based, по возрастанию). */
export function pickChallengePositions(
  total: number,
  count: number = CHALLENGE_WORDS,
  rnd: () => number = Math.random
): number[] {
  const n = Math.max(0, Math.min(count, total))
  const pool = Array.from({ length: total }, (_, i) => i + 1)
  const picked: number[] = []
  while (picked.length < n && pool.length) {
    const idx = Math.min(pool.length - 1, Math.floor(rnd() * pool.length))
    picked.push(pool.splice(idx, 1)[0]!)
  }
  return picked.sort((a, b) => a - b)
}

function norm(w: string): string {
  return w.normalize('NFC').trim().toLowerCase()
}

/** Все ответы совпали со словами на своих позициях (регистр/пробелы не важны). */
export function verifyWordChallenge(
  words: readonly string[],
  positions: readonly number[],
  answers: readonly string[]
): boolean {
  if (!positions.length || positions.length !== answers.length) return false
  return positions.every((pos, i) => {
    const expected = words[pos - 1]
    return !!expected && norm(expected) === norm(answers[i] ?? '')
  })
}

/** Для ключа без мнемоники: последние KEY_TAIL_CHARS символов (hex/WIF), без учёта регистра. */
export function verifyKeyTail(key: string, answer: string): boolean {
  const k = key.trim()
  if (k.length < KEY_TAIL_CHARS) return false
  return norm(k.slice(-KEY_TAIL_CHARS)) === norm(answer)
}
