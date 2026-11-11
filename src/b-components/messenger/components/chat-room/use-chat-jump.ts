/**
 * Переходы по ленте чата, как в Telegram: по цитате ответа — к исходному
 * сообщению, по календарю — к первому сообщению выбранного дня. Сообщение, к
 * которому пришли, на миг подсвечивается; после перехода по цитате стрелка
 * внизу ленты возвращает к ответу. Чего нет в ленте, догружается: история
 * сервера, копия на устройстве.
 */

import { nextTick, onScopeDispose, ref, shallowRef } from 'vue'
import type { Message } from '../../types'

/** Столько подсвечено сообщение, к которому перешли. */
export const FLASH_MS = 1600

/** Что догружается: исходное сообщение ответа или день из календаря. */
export type JumpWork = { kind: 'reply' } | { kind: 'date'; at: number }

export interface ChatJumpDeps {
  chatId: () => string | null
  /** Лента чата, от старых к новым. */
  messages: () => readonly Message[]
  /** Прокрутить ленту к сообщению; false — его в ленте нет. */
  reveal: (id: string) => Promise<boolean>
  /** Догрузить ленту до сообщения; время неизвестно — без него. */
  load: (
    chatId: string,
    target: { id: string; timestamp?: number },
    stop: () => boolean
  ) => Promise<unknown>
  /** Догрузить ленту до того, что было раньше `at`. */
  loadDate: (chatId: string, at: number, stop: () => boolean) => Promise<unknown>
  /** Когда отправлено сообщение; null — не узнали. */
  timeOf: (chatId: string, id: string) => Promise<number | null>
  /** Исходного сообщения нет: `gone` — не нашлось, `deleted` — удалено. */
  missing: (why: 'gone' | 'deleted') => void
}

export function useChatJump(deps: ChatJumpDeps) {
  /** Подсвеченное сообщение — к нему только что перешли. */
  const flashId = ref<string | null>(null)
  /** Ответ, от цитаты которого перешли: к нему ведёт стрелка внизу ленты. */
  const returnTo = ref<string | null>(null)
  /** Что сейчас догружается — для строки под поиском. */
  const work = shallowRef<JumpWork | null>(null)

  let seq = 0
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  function flash(id: string): void {
    if (flashTimer) clearTimeout(flashTimer)
    flashId.value = id
    flashTimer = setTimeout(() => {
      flashTimer = null
      if (flashId.value === id) flashId.value = null
    }, FLASH_MS)
  }

  async function land(id: string): Promise<boolean> {
    if (!(await deps.reveal(id))) return false
    flash(id)
    return true
  }

  /** Новый переход: прежний (и его догрузка) больше не нужен. */
  function begin(): { chatId: string; stopped: () => boolean } | null {
    const chatId = deps.chatId()
    if (!chatId) return null
    const mine = ++seq
    return { chatId, stopped: () => mine !== seq || deps.chatId() !== chatId }
  }

  /** Догрузка под строкой «Ищу…» со «Стоп»; потом — дождаться ленты с догруженным. */
  async function loading(what: JumpWork, stopped: () => boolean, run: () => Promise<unknown>) {
    work.value = what
    try {
      await run()
      await nextTick()
    } finally {
      if (!stopped()) work.value = null
    }
  }

  /** К сообщению, на которое отвечает `from`. */
  async function toReply(from: Message): Promise<void> {
    const id = from.replyTo?.id
    const go = id ? begin() : null
    if (!id || !go) return
    const find = () => deps.messages().find((m) => m.id === id)
    if (!find()) {
      await loading({ kind: 'reply' }, go.stopped, async () => {
        const at = await deps.timeOf(go.chatId, id)
        if (go.stopped()) return
        await deps.load(go.chatId, { id, timestamp: at ?? undefined }, go.stopped)
      })
      if (go.stopped()) return
    }
    const target = find()
    if (!target) return deps.missing('gone')
    if (target.deleted) return deps.missing('deleted')
    if ((await land(id)) && !go.stopped()) returnTo.value = from.id
  }

  /** К первому сообщению не раньше `at`; позже всех — к последнему. */
  async function toDate(at: number): Promise<void> {
    const go = begin()
    if (!go) return
    returnTo.value = null
    const first = deps.messages()[0]
    if (first && first.timestamp >= at) {
      await loading({ kind: 'date', at }, go.stopped, () =>
        deps.loadDate(go.chatId, at, go.stopped)
      )
      if (go.stopped()) return
    }
    const list = deps.messages().filter((m) => !m.deleted)
    const target = list.find((m) => m.timestamp >= at) ?? list[list.length - 1]
    if (target) await land(target.id)
  }

  /** Стрелка внизу ленты: обратно к ответу. */
  async function back(): Promise<void> {
    const id = returnTo.value
    returnTo.value = null
    if (id) await land(id)
  }

  /** «Остановить»: догрузка прекращается, лента остаётся, где была. */
  function stop(): void {
    seq++
    work.value = null
  }

  /** Сменился чат: всё прежнее не про него. */
  function reset(): void {
    stop()
    returnTo.value = null
    flashId.value = null
    if (flashTimer) clearTimeout(flashTimer)
    flashTimer = null
  }

  onScopeDispose(() => {
    if (flashTimer) clearTimeout(flashTimer)
  })

  return {
    flashId,
    returnTo,
    work,
    toReply,
    toDate,
    back,
    stop,
    reset,
    /** Ответ снова на экране — возвращаться не к чему. */
    forgetReturn: () => {
      returnTo.value = null
    },
  }
}
