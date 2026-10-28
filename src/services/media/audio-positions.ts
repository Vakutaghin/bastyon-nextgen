// Где остановились в длинных записях: аудиокниги, лекции, подкасты. Трек
// длиннее MIN_DURATION продолжает с того же места — и после перезапуска.
// Хранится на устройстве (`BST_AUDIO_POSITIONS_<адрес>`), без синхронизации:
// место меняется каждую секунду.

import { AUDIO_POSITIONS_PREFIX } from '@/blockchain/constants/storage'

/** Запоминаем у записей от 10 минут. */
export const MIN_DURATION = 600
/** Ближе к концу — считаем дослушанным. */
const END_MARGIN = 30
/** С первых секунд — не о чем помнить. */
const START_MARGIN = 15
const MAX_ENTRIES = 300

interface Entry {
  p: number
  t: number
}

function key(owner: string | null): string {
  return `${AUDIO_POSITIONS_PREFIX}${owner || 'guest'}`
}

function read(owner: string | null): Record<string, Entry> {
  try {
    const raw = localStorage.getItem(key(owner))
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, Entry>) : {}
  } catch {
    return {}
  }
}

function write(owner: string | null, entries: Record<string, Entry>): void {
  try {
    localStorage.setItem(key(owner), JSON.stringify(entries))
  } catch {
    /* переполнение — место не запомнится */
  }
}

/** Секунда, с которой продолжить; null — сначала. */
export function savedPosition(owner: string | null, id: string): number | null {
  const p = read(owner)[id]?.p
  return typeof p === 'number' && Number.isFinite(p) && p > START_MARGIN ? p : null
}

/** Запомнить место; дослушали — забыть. */
export function rememberPosition(
  owner: string | null,
  id: string,
  position: number,
  duration: number,
  now = Date.now()
): void {
  if (!(duration >= MIN_DURATION)) return
  const entries = read(owner)
  if (position < START_MARGIN || position > duration - END_MARGIN) {
    if (!entries[id]) return
    delete entries[id]
  } else {
    entries[id] = { p: Math.floor(position), t: now }
  }
  const ids = Object.keys(entries)
  if (ids.length > MAX_ENTRIES) {
    ids
      .sort((a, b) => entries[a]!.t - entries[b]!.t)
      .slice(0, ids.length - MAX_ENTRIES)
      .forEach((x) => delete entries[x])
  }
  write(owner, entries)
}
