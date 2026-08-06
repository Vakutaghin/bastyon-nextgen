/**
 * Фаза D — проверка дневной квоты загрузки ДО старта аплоуда.
 *
 * Порт из pocketnet.gui/js/peertube.js:1087-1146 (checkQuota/quota). Два источника:
 *   - GET api/v1/users/me                 → videoQuotaDaily, videoQuota (уже тянет getPeertubeChannel)
 *   - GET api/v1/users/me/video-quota-used → videoQuotaUsedDaily, videoQuotaUsed
 * Правило пропуска: `size + usedDaily < dailyQuota` ИЛИ `dailyQuota < 0` (безлимит).
 * Если размера/квоты нет — не блокируем, доверяем серверу (mirror оригинала).
 * VIDEO_QUOTA_CORRECTION в оригинале = 0, поэтому опущен.
 */

import { peertubeInstanceFetch, type InstanceFetch } from './peertube-instance'

/** Результат оценки квоты. */
export interface QuotaEvaluation {
  allowed: boolean
  /** Остаток дневной квоты в байтах (может быть отрицательным при переборе). */
  remainingDaily: number
  /** true, если дневная квота безлимитна (videoQuotaDaily < 0). */
  unlimited: boolean
}

/** Превышение дневной квоты. */
export class QuotaExceededError extends Error {
  remainingDaily: number
  constructor(remainingDaily: number) {
    super('peertube_daily_quota_exceeded')
    this.name = 'QuotaExceededError'
    this.remainingDaily = remainingDaily
  }
}

export interface EvaluateQuotaParams {
  /** Размер загружаемого файла (байты). */
  size: number
  videoQuotaDaily: number
  videoQuotaUsedDaily: number
  videoQuota: number
}

/**
 * Чистая оценка: помещается ли файл в дневную квоту. Без сети — легко тестируется.
 * Не можем оценить (нет размера/суточной/тотальной квоты) → allowed:true (доверяем серверу).
 */
export function evaluateQuota(params: EvaluateQuotaParams): QuotaEvaluation {
  const size = Number(params.size) || 0
  const videoQuotaDaily = Number(params.videoQuotaDaily) || 0
  const videoQuotaUsedDaily = Number(params.videoQuotaUsedDaily) || 0
  const videoQuota = Number(params.videoQuota) || 0

  const unlimited = videoQuotaDaily < 0
  const remainingDaily = videoQuotaDaily - videoQuotaUsedDaily

  // Нечего сравнивать — пропускаем (как оригинал: !size || !dailyQuota || !totalQuota → resolve).
  if (!size || !videoQuotaDaily || !videoQuota) {
    return { allowed: true, remainingDaily, unlimited }
  }

  const allowed = unlimited || size + videoQuotaUsedDaily < videoQuotaDaily
  return { allowed, remainingDaily, unlimited }
}

export interface QuotaUsed {
  videoQuotaUsedDaily: number
  videoQuotaUsed: number
}

export interface FetchQuotaUsedParams {
  host: string
  accessToken: string
  fetchInstance?: InstanceFetch
}

/** GET users/me/video-quota-used (Bearer). Реджект, если инстанс не вернул videoQuotaUsedDaily. */
export async function fetchDailyQuotaUsed(params: FetchQuotaUsedParams): Promise<QuotaUsed> {
  const { host, accessToken } = params
  const fetchInstance: InstanceFetch =
    params.fetchInstance ?? ((path, init) => peertubeInstanceFetch(host, path, init))

  const res = await fetchInstance('api/v1/users/me/video-quota-used', {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`peertube_quota_used_${res.status}`)
  const j = (await res.json()) as { videoQuotaUsedDaily?: number; videoQuotaUsed?: number } | null
  if (typeof j?.videoQuotaUsedDaily !== 'number') throw new Error('peertube_quota_used_invalid')
  return {
    videoQuotaUsedDaily: j.videoQuotaUsedDaily,
    videoQuotaUsed: Number(j.videoQuotaUsed) || 0,
  }
}

export interface CheckDailyQuotaParams {
  size: number
  /** Из getPeertubeChannel (users/me) — не фетчим повторно. */
  videoQuotaDaily: number
  videoQuota: number
  host: string
  accessToken: string
  fetchInstance?: InstanceFetch
}

/**
 * Фетчит video-quota-used и оценивает вместимость. Кидает QuotaExceededError при переборе.
 * `videoQuotaDaily`/`videoQuota` берём из уже полученного канала — экономим второй users/me.
 */
export async function checkDailyQuota(params: CheckDailyQuotaParams): Promise<QuotaEvaluation> {
  const { videoQuotaUsedDaily } = await fetchDailyQuotaUsed({
    host: params.host,
    accessToken: params.accessToken,
    fetchInstance: params.fetchInstance,
  })

  const evaluation = evaluateQuota({
    size: params.size,
    videoQuotaDaily: params.videoQuotaDaily,
    videoQuotaUsedDaily,
    videoQuota: params.videoQuota,
  })

  if (!evaluation.allowed) throw new QuotaExceededError(evaluation.remainingDaily)
  return evaluation
}
