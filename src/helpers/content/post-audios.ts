// Несколько записей в одном аудио-посте: аудиокнига по главам, альбом. В
// протоколе у поста одна ссылка `u`, поэтому список лежит в настройках —
// `s.audios = [{ u, c, d }]`: настройки нода хранит целиком, а в хеш поста они
// не входят (как у опроса, helpers/content/poll.ts). `u` поста — первая запись:
// прежний Bastyon и старые версии приложения играют её одну.

import { parsePeerTubeUrl } from '@/helpers/api/peertube-parser'

export interface PostAudio {
  /** `peertube://хост/uuid/audio`. */
  url: string
  /** Название главы или трека; пусто — без названия. */
  title: string
  /** Секунды; null — неизвестно. */
  duration: number | null
}

/** Запись в настройках поста (`s.audios`). */
export interface PostAudioSetting {
  u: string
  c?: string
  d?: number
}

/** Сколько записей в посте. Столько же — при показе: список писал кто угодно. */
export const MAX_POST_AUDIOS = 100
export const MAX_AUDIO_TITLE = 120
/** Дольше суток записей не бывает: больше — выдумка. */
const MAX_DURATION = 24 * 60 * 60

/** Одна запись — один ключ, с `/audio` в указателе или без. */
function audioKey(url: string): string | null {
  const parsed = parsePeerTubeUrl(url)
  return parsed ? `${parsed.host.toLowerCase()}/${parsed.videoId}` : null
}

export function isAudioPointer(url: string): boolean {
  return parsePeerTubeUrl(url)?.type === 'audio'
}

/** uuid записи — по нему запоминается место, даже если порядок поменяют. */
export function audioUuid(url: string): string {
  return parsePeerTubeUrl(url)?.videoId ?? url
}

/**
 * Записи из `s.audios` поста со ссылкой `url`. Пустой список — обычный пост с
 * одной записью. Ссылка поста всегда среди записей: нет её в списке — первой.
 */
export function parsePostAudios(raw: unknown, url: string | undefined | null): PostAudio[] {
  if (!url || !isAudioPointer(url) || !Array.isArray(raw)) return []
  const list: PostAudio[] = []
  const seen = new Set<string>()
  for (const item of raw as unknown[]) {
    if (!item || typeof item !== 'object') continue
    const { u, c, d } = item as { u?: unknown; c?: unknown; d?: unknown }
    if (typeof u !== 'string' || !isAudioPointer(u)) continue
    const key = audioKey(u)!
    if (seen.has(key)) continue
    seen.add(key)
    list.push({
      url: u,
      title: typeof c === 'string' ? c.trim().slice(0, MAX_AUDIO_TITLE) : '',
      duration:
        typeof d === 'number' && Number.isFinite(d) && d > 0 && d <= MAX_DURATION
          ? Math.round(d)
          : null,
    })
  }
  if (!seen.has(audioKey(url)!)) list.unshift({ url, title: '', duration: null })
  return list.length > 1 ? list.slice(0, MAX_POST_AUDIOS) : []
}

/** Записи поста — из адаптера ленты; у поста с одной записью список пустой. */
export function postAudios(post: {
  audios?: PostAudio[]
  videoUrl?: string
  type?: string
  settings?: { audios?: unknown; [key: string]: unknown }
}): PostAudio[] {
  if (post.type && post.type !== 'audio') return []
  return post.audios ?? parsePostAudios(post.settings?.audios, post.videoUrl)
}

/** Для настроек поста: список — только если записей больше одной. */
export function audiosSetting(list: readonly PostAudio[]): PostAudioSetting[] | undefined {
  if (list.length < 2) return undefined
  return list.slice(0, MAX_POST_AUDIOS).map((audio) => {
    const title = audio.title.trim().slice(0, MAX_AUDIO_TITLE)
    return {
      u: audio.url,
      ...(title ? { c: title } : {}),
      ...(audio.duration ? { d: Math.round(audio.duration) } : {}),
    }
  })
}

/** Сколько всё длится; null — длительность какой-то записи неизвестна. */
export function totalDuration(list: readonly PostAudio[]): number | null {
  let sum = 0
  for (const audio of list) {
    if (!audio.duration) return null
    sum += audio.duration
  }
  return sum || null
}
