/**
 * Окно «Лимиты загрузки»: сервер, куда пойдёт загрузка, его дневной лимит для
 * этого аккаунта и что он принимает. Сервер выбирает нода — так же, как при
 * загрузке (peertube/best), и так же делало прежнее приложение.
 */

import { computed, ref, shallowRef } from 'vue'

import { resolvePeertubeHost } from '@/services/peertube/peertube-host'
import {
  AUDIO_EXTENSIONS,
  DEFAULT_UPLOAD_EXTENSIONS,
  getInstanceUploadConfig,
  getUploadQuota,
  quotaTier,
  type InstanceUploadConfig,
  type UploadQuota,
} from '@/services/peertube/peertube-upload-limits'
import { logger } from '@/services/logger'

const log = logger.scope('[upload-limits]')

export interface UploadLimitsDeps {
  resolveHost: () => Promise<string>
  config: (host: string) => Promise<InstanceUploadConfig>
  quota: (host: string, accessToken: string) => Promise<UploadQuota>
  /** Токен автора на сервере; null — не вошёл. */
  token: ((host: string) => Promise<string>) | null
}

/** «.mp4» → «MP4», через запятую. */
const formatList = (extensions: string[]): string =>
  extensions.map((ext) => ext.replace(/^\./, '').toUpperCase()).join(', ')

export function useUploadLimits(options: { deps?: Partial<UploadLimitsDeps> } = {}) {
  const deps: UploadLimitsDeps = {
    resolveHost: () => resolvePeertubeHost('upload'),
    config: (host) => getInstanceUploadConfig(host),
    quota: (host, accessToken) => getUploadQuota({ host, accessToken }),
    token: null,
    ...options.deps,
  }

  const loading = ref(false)
  const host = ref<string | null>(null)
  const quota = shallowRef<UploadQuota | null>(null)
  /** Лимит узнать не вышло: нода не дала сервер или сервер не ответил. */
  const quotaFailed = ref(false)
  const config = shallowRef<InstanceUploadConfig | null>(null)

  async function load(): Promise<void> {
    if (loading.value) return
    loading.value = true
    quotaFailed.value = false
    try {
      const target = host.value ?? (await deps.resolveHost())
      host.value = target
      const token = deps.token
      await Promise.all([
        deps
          .config(target)
          .then((value) => {
            config.value = value
          })
          // Форматы и без сервера известны — список по умолчанию.
          .catch((error) => log.debug('config failed', error)),
        token
          ? token(target)
              .then((accessToken) => deps.quota(target, accessToken))
              .then((value) => {
                quota.value = value
              })
          : Promise.resolve(),
      ])
    } catch (error) {
      log.warn('quota failed', error)
      quotaFailed.value = true
    } finally {
      loading.value = false
    }
  }

  const unlimited = computed(() => (quota.value ? quota.value.daily < 0 : false))
  const remaining = computed(() =>
    quota.value ? Math.max(0, quota.value.daily - quota.value.usedDaily) : 0
  )
  /** Доля потраченного, 0…100. */
  const usedPercent = computed(() => {
    const value = quota.value
    if (!value || value.daily <= 0) return 0
    return Math.min(100, Math.round((value.usedDaily / value.daily) * 100))
  })
  const tier = computed(() => (quota.value ? quotaTier(quota.value.daily) : null))

  const extensions = computed(() => config.value?.extensions ?? [...DEFAULT_UPLOAD_EXTENSIONS])
  const videoFormats = computed(() =>
    formatList(extensions.value.filter((ext) => !AUDIO_EXTENSIONS.has(ext)))
  )
  const audioFormats = computed(() =>
    formatList(extensions.value.filter((ext) => AUDIO_EXTENSIONS.has(ext)))
  )
  const maxResolution = computed(() => config.value?.maxResolution ?? null)

  return {
    loading,
    host,
    quota,
    quotaFailed,
    unlimited,
    remaining,
    usedPercent,
    tier,
    videoFormats,
    audioFormats,
    maxResolution,
    load,
  }
}
