// Resume-состояние resumable-загрузки PeerTube в localStorage: чистый
// persistence-адаптер (ключ = host+address+videoKey, TTL 12 ч). Вынесен из
// peertube-upload.ts, чтобы транспорт не знал про storage.

import { PEERTUBE_RESUME_PREFIX } from '@/blockchain/constants/storage'

/** TTL resume-состояния — возобновляем незавершённую загрузку в пределах 12 ч. */
export const RESUME_TTL_MS = 12 * 60 * 60 * 1000

/** Resume-состояние в localStorage (ключ = host+address+videoKey). */
export interface ResumableState {
  uploadHost: string
  uploadId: string
  resumeFrom: number
  lastOperation: number
}

/** Ключ resume-состояния — как в оригинале: `resumable_${host}_${address}_${videoKey}`. */
export function resumableStorageKey(host: string, address: string, videoKey: string): string {
  return `${PEERTUBE_RESUME_PREFIX}${host}_${address}_${videoKey}`
}

/** Валидное и не протухшее состояние, иначе null (в т.ч. при недоступном storage). */
export function loadResumableState(key: string, now: number): ResumableState | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const s = JSON.parse(raw) as Partial<ResumableState>
    if (!s?.uploadId || typeof s.resumeFrom !== 'number' || typeof s.lastOperation !== 'number') {
      return null
    }
    if (now - s.lastOperation > RESUME_TTL_MS) return null // протух — заставим переинициализировать
    return s as ResumableState
  } catch {
    return null
  }
}

export function saveResumableState(key: string, state: ResumableState): void {
  try {
    localStorage.setItem(key, JSON.stringify(state))
  } catch {
    // недоступность storage не критична — просто не сможем возобновить.
  }
}

export function clearResumableState(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // no-op
  }
}
