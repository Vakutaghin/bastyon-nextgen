// Голосовые на время работы приложения: скачанный и расшифрованный звук,
// волна и длительность, узнанные по нему. Уход из чата и возврат, прокрутка
// ленты, второй раз «Слушать» — без нового скачивания и расшифровки, а волна
// голосового без неё в событии остаётся нарисованной.

/** Сколько звука держим в памяти: последние прослушанные, старые вытесняются. */
const BLOB_BUDGET = 24 * 1024 * 1024
/** Волн и длительностей — числа, их много не жалко, но не бесконечно. */
const META_LIMIT = 2000

const blobs = new Map<string, Blob>()
let blobBytes = 0
const waves = new Map<string, number[]>()
const durations = new Map<string, number>()

function touch<T>(map: Map<string, T>, id: string): T | undefined {
  const value = map.get(id)
  if (value === undefined) return undefined
  // Map помнит порядок вставки: переставленное в конец вытесняется последним.
  map.delete(id)
  map.set(id, value)
  return value
}

function capped<T>(map: Map<string, T>, id: string, value: T): void {
  map.delete(id)
  map.set(id, value)
  while (map.size > META_LIMIT) {
    const oldest = map.keys().next().value
    if (oldest === undefined) break
    map.delete(oldest)
  }
}

export function cachedVoice(id: string): Blob | undefined {
  return touch(blobs, id)
}

export function cacheVoice(id: string, blob: Blob): void {
  // Длинную запись не держим: она вытеснила бы всё остальное.
  if (blob.size > BLOB_BUDGET / 4) return
  const prev = blobs.get(id)
  if (prev) blobBytes -= prev.size
  blobs.delete(id)
  blobs.set(id, blob)
  blobBytes += blob.size
  for (const [oldId, old] of blobs) {
    if (blobBytes <= BLOB_BUDGET) break
    blobs.delete(oldId)
    blobBytes -= old.size
  }
}

export function learnedWave(id: string): number[] | undefined {
  return touch(waves, id)
}

export function learnWave(id: string, samples: number[]): void {
  capped(waves, id, samples)
}

export function learnedDuration(id: string): number | undefined {
  return touch(durations, id)
}

export function learnDuration(id: string, seconds: number): void {
  capped(durations, id, seconds)
}

/** Выход из аккаунта: расшифрованное чужому аккаунту не оставляем. */
export function clearVoiceCache(): void {
  blobs.clear()
  blobBytes = 0
  waves.clear()
  durations.clear()
}
