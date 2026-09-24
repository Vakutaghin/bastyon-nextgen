/**
 * Проверка обновлений через релизы GitHub.
 *
 * Приложение не обновляет себя само (для этого нужен подписанный апдейтер и
 * сервер обновлений) — оно узнаёт, что вышла новая версия, и предлагает
 * перейти на страницу релиза, где лежат установщики под все платформы.
 *
 * Состояние модульное, а не на вызов: одно и то же нужно модалке и кнопке
 * «Проверить обновления» в диагностике — иначе они проверяли бы по отдельности.
 *
 * Запрос идёт через `appFetch`: при включённом Tor он уходит в Tor, а не
 * напрямую на api.github.com (V20, fail-closed).
 */

import { computed, ref } from 'vue'
import { appFetch } from '@/helpers/api/fetch-strategies'
import { CURRENT_APP_VERSION } from '@/helpers/changelog/changelog-loader'
import { openExternal } from '@/helpers/common/open-external'
import {
  LATEST_RELEASE_URL,
  isUpdateAvailable,
  parseLatestRelease,
  type LatestRelease,
} from '@/helpers/updates/github-release'
import { isCapacitor, isTauri } from '@/b-components/video-uploader/utils/environment'
import { settingsAPI } from '@/db/apis/settings-api'
import { logger } from '@/services/logger'

const log = logger.scope('[update]')

const SETTING_KEY_LAST_CHECKED = 'bastyonUpdateLastCheckedAt'
const SETTING_KEY_SKIPPED_VERSION = 'bastyonUpdateSkippedVersion'

/** Чаще раза в сутки дёргать GitHub незачем: у него ещё и лимит на анонимные запросы. */
export const AUTO_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

/** Проверка не должна висеть вечно, если сеть молчит. */
const REQUEST_TIMEOUT_MS = 10_000

const available = ref<LatestRelease | null>(null)
const checking = ref(false)
const failed = ref(false)
/** Проверка уже отработала хотя бы раз за этот запуск — чтобы не врать «всё актуально» до неё. */
const checked = ref(false)
const skippedVersion = ref<string | null>(null)
/** Закрытие модалки действует до перезапуска; «пропустить версию» — навсегда. */
const dismissedForSession = ref(false)

let inflight: Promise<LatestRelease | null> | null = null

/**
 * Автопроверка — только в упакованной сборке. В браузере «скачайте новую
 * версию» бессмысленно: там открыт уже развёрнутый билд, обновление = перезагрузка.
 */
export function supportsUpdateCheck(): boolean {
  return isTauri() || isCapacitor()
}

async function readSkippedVersion(): Promise<string | null> {
  try {
    const stored = await settingsAPI.get(SETTING_KEY_SKIPPED_VERSION)
    return typeof stored === 'string' ? stored : null
  } catch (e) {
    log.debug('failed to read skipped version', e)
    return null
  }
}

async function readLastCheckedAt(): Promise<number> {
  try {
    const stored = await settingsAPI.get(SETTING_KEY_LAST_CHECKED)
    return typeof stored === 'number' && Number.isFinite(stored) ? stored : 0
  } catch (e) {
    log.debug('failed to read last check time', e)
    return 0
  }
}

async function fetchLatestRelease(): Promise<LatestRelease | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await appFetch(LATEST_RELEASE_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      credentials: 'omit',
      signal: controller.signal,
    })
    if (!res.ok) {
      log.debug('github answered', res.status)
      return null
    }
    return parseLatestRelease(await res.json())
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Спрашивает GitHub о последнем релизе и обновляет состояние.
 *
 * Ошибка сети — не повод шуметь: `failed` поднимается для ручной проверки
 * (там пользователь ждёт ответа), а автопроверка просто молчит до следующего раза.
 */
export async function checkForUpdate(): Promise<LatestRelease | null> {
  if (inflight) return inflight

  checking.value = true
  failed.value = false

  inflight = (async () => {
    try {
      const release = await fetchLatestRelease()
      if (!release) {
        failed.value = true
        return null
      }
      available.value = isUpdateAvailable(release, CURRENT_APP_VERSION) ? release : null
      await settingsAPI.set(SETTING_KEY_LAST_CHECKED, Date.now())
      return available.value
    } catch (e) {
      failed.value = true
      log.debug('check failed', e)
      return null
    } finally {
      checked.value = true
      checking.value = false
      inflight = null
    }
  })()

  return inflight
}

/**
 * Фоновая проверка при старте: не в браузере, не в dev и не чаще, чем раз в сутки.
 */
export async function maybeCheckForUpdate(): Promise<void> {
  if (!supportsUpdateCheck()) return
  if (import.meta.env.DEV) return

  skippedVersion.value = await readSkippedVersion()

  const lastCheckedAt = await readLastCheckedAt()
  if (Date.now() - lastCheckedAt < AUTO_CHECK_INTERVAL_MS) return

  await checkForUpdate()
}

/** Ручная проверка из настроек: без троттлинга и вне зависимости от платформы. */
export async function checkForUpdateNow(): Promise<LatestRelease | null> {
  skippedVersion.value = await readSkippedVersion()
  dismissedForSession.value = false
  return checkForUpdate()
}

/** Закрыть предложение до следующего запуска. */
export function dismissUpdate(): void {
  dismissedForSession.value = true
}

/** Больше не предлагать именно эту версию. */
export async function skipAvailableVersion(): Promise<void> {
  const version = available.value?.version
  dismissedForSession.value = true
  if (!version) return
  skippedVersion.value = version
  try {
    await settingsAPI.set(SETTING_KEY_SKIPPED_VERSION, version)
  } catch (e) {
    log.debug('failed to persist skipped version', e)
  }
}

/** Открыть страницу релиза в системном браузере. */
export async function openReleasePage(): Promise<boolean> {
  const release = available.value
  if (!release) return false
  return openExternal(release.pageUrl)
}

/** Сброс модульного состояния — только для тестов. */
export function resetAppUpdateForTests(): void {
  available.value = null
  checking.value = false
  failed.value = false
  checked.value = false
  skippedVersion.value = null
  dismissedForSession.value = false
  inflight = null
}

export function useAppUpdate() {
  const shouldPrompt = computed(
    () =>
      available.value !== null &&
      !dismissedForSession.value &&
      available.value.version !== skippedVersion.value
  )

  return {
    available,
    checking,
    failed,
    checked,
    shouldPrompt,
    currentVersion: CURRENT_APP_VERSION,
    check: checkForUpdateNow,
    maybeCheck: maybeCheckForUpdate,
    dismiss: dismissUpdate,
    skip: skipAvailableVersion,
    openReleasePage,
  }
}
