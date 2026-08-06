/**
 * Фаза A — выбор PeerTube-хоста для загрузки видео.
 *
 * Нода отдаёт хост через `peertube/best`. Тот же контракт уже используется для
 * загрузки картинок (image-upload-service). Полноценный двухступенчатый выбор
 * (roys → детерминированный рой по адресу → best) — отдельный [should], здесь
 * минимально достаточный путь: best {type:'upload'} (нода сама берёт randroykey).
 */

import { fetchHttp } from '@/helpers/api/request'

/** Тип отбора инстанса под задачу (веса ранжирования на ноде различаются). */
export type PeertubeHostType = 'upload' | 'importVideo' | 'liveStream'

/**
 * Резолвит хост под задачу через ноду (`peertube/best`). Бросает, если нода не
 * вернула хост (все инстансы заполнены/недоступны — вызывающий показывает ретрай).
 */
export async function resolvePeertubeHost(type: PeertubeHostType = 'upload'): Promise<string> {
  const res = (await fetchHttp({ path: 'peertube/best', data: { type } })) as
    | { host?: string }
    | string
    | null

  const host = typeof res === 'string' ? res : res?.host
  if (!host) throw new Error('peertube_no_host')
  return host
}
