/**
 * Объявления для экранного диктора (TalkBack, VoiceOver, NVDA): невидимые
 * живые области в конце <body>. Тост, смена страницы, новое сообщение
 * произносятся, хотя фокус остаётся, где был.
 *
 * Области создаются заранее (`installLiveRegions` при запуске): диктор
 * следит только за областями, которые уже были в документе, — созданная
 * вместе с текстом часто молчит. Текст ставится с задержкой и перед этим
 * стирается, чтобы одинаковое объявление подряд прозвучало снова.
 */

export type AnnouncePoliteness = 'polite' | 'assertive'

const IDS: Record<AnnouncePoliteness, string> = {
  polite: 'a11y-live-polite',
  assertive: 'a11y-live-assertive',
}

/** Через сколько после очистки ставить текст: дикторы склеивают мгновенную замену. */
const SET_DELAY_MS = 60

const timers: Partial<Record<AnnouncePoliteness, ReturnType<typeof setTimeout>>> = {}

function region(politeness: AnnouncePoliteness, doc: Document): HTMLElement {
  const existing = doc.getElementById(IDS[politeness])
  if (existing) return existing
  const el = doc.createElement('div')
  el.id = IDS[politeness]
  el.className = 'visually-hidden'
  el.setAttribute('aria-live', politeness)
  el.setAttribute('aria-atomic', 'true')
  // role=status/alert — для дикторов, которые смотрят на роль, а не на aria-live.
  el.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status')
  doc.body.appendChild(el)
  return el
}

/** Обе области — при запуске приложения, до первого объявления. */
export function installLiveRegions(doc: Document = document): void {
  region('polite', doc)
  region('assertive', doc)
}

/** Произнести текст. `assertive` — перебивает диктора (ошибки), `polite` — дожидается паузы. */
export function announce(
  text: string,
  politeness: AnnouncePoliteness = 'polite',
  doc: Document = document
): void {
  const message = text.trim()
  if (!message || !doc.body) return
  const el = region(politeness, doc)
  el.textContent = ''
  clearTimeout(timers[politeness])
  timers[politeness] = setTimeout(() => {
    el.textContent = message
  }, SET_DELAY_MS)
}
