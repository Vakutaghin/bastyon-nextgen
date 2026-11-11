/**
 * Поиск глубже загруженной ленты чата. Искать в зашифрованном сервер не
 * умеет, а хранит переписку три месяца — ищет приложение: читает копию
 * переписки на устройстве (если сохранение включено) и само листает историю
 * на сервере назад, расшифровывая её. Идёт в фоне, пока в поле поиска есть
 * слова; можно остановить. Прочитанное держится, пока открыт чат: следующий
 * запрос ищет в нём сразу, ничего не загружая.
 */

import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { Message } from '../../types'

/** Пауза между страницами истории — сервер и расшифровка не забивают всё остальное. */
export const SCAN_PAUSE_MS = 300
/** Столько страниц подряд не пришло за отведённое время — сервер не отвечает. */
export const SCAN_RETRIES = 3

export interface HistoryPage {
  messages: Message[]
  /** Сервер старше ничего не отдаст. */
  exhausted: boolean
  /** Страница не пришла вовремя. */
  slow?: boolean
}

export interface HistorySearchDeps {
  chatId: () => string | null
  /** В поле поиска есть слова. */
  active: () => boolean
  /** Следующая страница истории сервера глубже прочитанного. */
  scan: (chatId: string) => Promise<HistoryPage>
  /** Вся копия чата на устройстве; копии нет — пусто. */
  readArchive: (chatId: string) => Promise<Message[]>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function useHistorySearch(deps: HistorySearchDeps) {
  /** Прочитанное глубже ленты: история сервера и копия на устройстве. */
  const found = shallowRef<Message[]>([])
  const scanning = ref(false)
  const stopped = ref(false)
  /** История сервера прочитана до конца. */
  const done = ref(false)
  /** Сервер перестал отвечать или ответил ошибкой. */
  const failed = ref(false)
  /** До какого времени прочитана история сервера. */
  const reached = ref<number | null>(null)
  let archiveRead = false
  let disposed = false

  function add(list: readonly Message[]): void {
    if (list.length) found.value = [...found.value, ...list]
  }

  async function readArchive(chatId: string): Promise<void> {
    if (archiveRead) return
    archiveRead = true
    try {
      const list = await deps.readArchive(chatId)
      if (!disposed) add(list)
    } catch (e) {
      console.warn('[chat-search] archive read failed', e)
    }
  }

  async function run(): Promise<void> {
    const chatId = deps.chatId()
    if (!chatId || disposed || scanning.value || done.value || stopped.value) return
    scanning.value = true
    failed.value = false
    void readArchive(chatId)
    let misses = 0
    try {
      while (!disposed && !stopped.value && deps.active() && deps.chatId() === chatId) {
        const page = await deps.scan(chatId)
        if (disposed) return
        add(page.messages)
        for (const m of page.messages) {
          if (reached.value === null || m.timestamp < reached.value) reached.value = m.timestamp
        }
        if (page.exhausted) {
          done.value = true
          break
        }
        if (stopped.value) break
        misses = page.slow ? misses + 1 : 0
        if (misses >= SCAN_RETRIES) {
          failed.value = true
          break
        }
        await sleep(SCAN_PAUSE_MS)
      }
    } catch (e) {
      console.warn('[chat-search] history scan failed', e)
      failed.value = true
    } finally {
      scanning.value = false
    }
  }

  function stop(): void {
    stopped.value = true
  }

  function resume(): void {
    stopped.value = false
    failed.value = false
    void run()
  }

  watch(
    () => deps.active(),
    (on) => {
      if (on && !failed.value) void run()
    },
    { immediate: true }
  )
  onScopeDispose(() => {
    disposed = true
  })

  return { found, scanning, stopped, done, failed, reached, stop, resume }
}
