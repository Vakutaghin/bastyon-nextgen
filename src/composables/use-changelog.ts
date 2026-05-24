/**
 * Composable для работы с changelog.
 *
 * - Возвращает список всех версий + содержимое в текущем языке (реактивно).
 * - Отслеживает «последнюю увиденную пользователем» версию, чтобы окно
 *   «Что нового» открывалось ровно один раз при обновлении приложения.
 */

import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import {
  CURRENT_APP_VERSION,
  getAllChangelogEntries,
  getChangelogText,
  getLatestChangelogEntry,
  type ChangelogEntry,
} from '@/helpers/changelog/changelog-loader'
import { renderMarkdown } from '@/helpers/changelog/markdown'
import { useUIStore } from '@/stores/ui-store'
import { settingsAPI } from '@/db/apis/settings-api'

const SETTING_KEY_LAST_SEEN = 'bastyonChangelogLastSeenVersion'

export interface RenderedChangelogEntry extends ChangelogEntry {
  /** Готовый HTML, отрендеренный из markdown в выбранном языке. */
  html: string
}

function renderEntries(language: 'ru' | 'en'): RenderedChangelogEntry[] {
  return getAllChangelogEntries().map((e) => ({
    ...e,
    html: renderMarkdown(getChangelogText(e, language)),
  }))
}

export function useChangelog() {
  const uiStore = useUIStore()
  const { language } = storeToRefs(uiStore)

  const entries = computed<RenderedChangelogEntry[]>(() => renderEntries(language.value))

  const latest = computed<RenderedChangelogEntry | undefined>(() => {
    const e = getLatestChangelogEntry()
    if (!e) return undefined
    return {
      ...e,
      html: renderMarkdown(getChangelogText(e, language.value)),
    }
  })

  return {
    entries,
    latest,
    currentVersion: CURRENT_APP_VERSION,
  }
}

/**
 * Управление окном «Что нового». Хранит решение пользователя в IndexedDB,
 * чтобы модалка не всплывала снова на этой же версии после перезапуска.
 */
export function useWhatsNewGate() {
  const lastSeenVersion = ref<string | null>(null)
  const ready = ref(false)
  const open = ref(false)

  async function load(): Promise<void> {
    try {
      const stored = await settingsAPI.get(SETTING_KEY_LAST_SEEN)
      lastSeenVersion.value = typeof stored === 'string' ? stored : null
    } catch (e) {
      console.error('Failed to load last-seen changelog version:', e)
    } finally {
      ready.value = true
      const latest = getLatestChangelogEntry()
      if (latest && latest.version !== lastSeenVersion.value) {
        open.value = true
      }
    }
  }

  async function dismiss(): Promise<void> {
    open.value = false
    const latest = getLatestChangelogEntry()
    if (!latest) return
    lastSeenVersion.value = latest.version
    try {
      await settingsAPI.set(SETTING_KEY_LAST_SEEN, latest.version)
    } catch (e) {
      console.error('Failed to persist last-seen changelog version:', e)
    }
  }

  onMounted(load)

  return {
    ready,
    open,
    dismiss,
    lastSeenVersion,
  }
}
