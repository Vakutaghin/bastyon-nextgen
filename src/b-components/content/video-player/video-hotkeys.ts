/**
 * Горячие клавиши видеоплееров: какая клавиша что делает, когда она не
 * принадлежит плееру и сколько раз срабатывает, пока её держат.
 *
 * Слушатель один на все плееры — в video-player-manager. Раньше клавиши ловили
 * двое: общий обработчик приложения и каждый плеер сам по себе. Пробел ставил
 * ролик на паузу и тут же запускал снова: иконка мелькала, видео шло дальше.
 */

import { SEEK_REPEAT_INTERVAL, VISIBILITY_THRESHOLD, VOLUME_REPEAT_INTERVAL } from './consts'

type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

export type HotkeyAction =
  | 'playPause'
  | 'seekForward'
  | 'seekBackward'
  | 'seekForwardLong'
  | 'seekBackwardLong'
  | 'seekStart'
  | 'seekEnd'
  /** Цифра N — к N×10 % ролика, как у YouTube. */
  | `seekTo${Digit}`
  | 'frameForward'
  | 'frameBackward'
  | 'volumeUp'
  | 'volumeDown'
  | 'mute'
  | 'fullscreen'
  | 'pip'
  | 'speedUp'
  | 'speedDown'
  | 'help'
  | 'escape'

/**
 * По физической клавише (`code`), а не по символу — работает в любой
 * раскладке. Раскладка клавиш — как у YouTube: стрелки на 5 секунд, J и L
 * на 10, цифры — к доле ролика, запятая и точка — на кадр.
 */
const KEYS: Record<string, HotkeyAction> = {
  Space: 'playPause',
  KeyK: 'playPause',
  ArrowRight: 'seekForward',
  ArrowLeft: 'seekBackward',
  KeyL: 'seekForwardLong',
  KeyJ: 'seekBackwardLong',
  Home: 'seekStart',
  End: 'seekEnd',
  Period: 'frameForward',
  Comma: 'frameBackward',
  ArrowUp: 'volumeUp',
  ArrowDown: 'volumeDown',
  KeyM: 'mute',
  KeyF: 'fullscreen',
  KeyI: 'pip',
  Escape: 'escape',
  ...Object.fromEntries(
    Array.from({ length: 10 }, (_, n) => [
      [`Digit${n}`, `seekTo${n}` as HotkeyAction],
      [`Numpad${n}`, `seekTo${n}` as HotkeyAction],
    ]).flat()
  ),
}

/** С Shift: `>` и `<` — скорость, `?` — справка по клавишам. */
const SHIFT_KEYS: Record<string, HotkeyAction> = {
  Period: 'speedUp',
  Comma: 'speedDown',
  Slash: 'help',
}

/** Клавиша события: `code`, а если его нет (экранные клавиатуры) — пробел по `key`. */
export function hotkeyCode(event: KeyboardEvent): string {
  return event.code || (event.key === ' ' ? 'Space' : event.key)
}

export function hotkeyAction(event: KeyboardEvent): HotkeyAction | null {
  // Ctrl, Cmd и Alt — сочетания браузера и системы: Cmd+F — поиск, а не полный экран.
  if (event.ctrlKey || event.metaKey || event.altKey) return null
  return (event.shiftKey ? SHIFT_KEYS : KEYS)[hotkeyCode(event)] ?? null
}

/**
 * Автоповтор зажатой клавиши. `null` — только первое нажатие: пробел, M и F
 * не должны щёлкать 30 раз в секунду. Число — не чаще раза в столько мс:
 * перемотка, покадровый шаг и громкость едут плавно.
 */
function repeatInterval(action: HotkeyAction): number | null {
  switch (action) {
    case 'seekForward':
    case 'seekBackward':
    case 'seekForwardLong':
    case 'seekBackwardLong':
    case 'frameForward':
    case 'frameBackward':
      return SEEK_REPEAT_INTERVAL
    case 'volumeUp':
    case 'volumeDown':
      return VOLUME_REPEAT_INTERVAL
    default:
      return null
  }
}

/**
 * Что делать с автоповтором: `pass` — первое нажатие было не наше (ушло в поле
 * ввода или в прокрутку), не трогаем; `swallow` — наше, но повторять рано;
 * `run` — выполнить ещё раз.
 */
export type RepeatDecision = 'pass' | 'swallow' | 'run'

/** Зажатые клавиши плеера и когда каждая сработала в последний раз. */
export class HeldHotkeys {
  private readonly lastRun = new Map<string, number>()

  /** Первое нажатие плеер обработал: автоповтор этой клавиши теперь его. */
  press(code: string, now: number): void {
    this.lastRun.set(code, now)
  }

  repeat(code: string, action: HotkeyAction, now: number): RepeatDecision {
    const last = this.lastRun.get(code)
    if (last === undefined) return 'pass'
    const interval = repeatInterval(action)
    if (interval === null || now - last < interval) return 'swallow'
    this.lastRun.set(code, now)
    return 'run'
  }

  /** Клавишу отпустили; `true` — она была наша. */
  release(code: string): boolean {
    return this.lastRun.delete(code)
  }

  /** Окно потеряло фокус: отпускания клавиш уже не придут. */
  clear(): void {
    this.lastRun.clear()
  }
}

/** Поля ввода: в них клавиши — это текст. */
const FORM_FIELDS = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'

/** Элементы со своим действием на пробел и стрелки. */
const INTERACTIVE = [
  'button',
  'a[href]',
  'summary',
  'audio',
  'video',
  ...[
    'button',
    'checkbox',
    'radio',
    'switch',
    'menuitem',
    'option',
    'tab',
    'combobox',
    'textbox',
    'slider',
  ].map((role) => `[role="${role}"]`),
].join(', ')

/** Модалки и боковые панели: клавиши в них принадлежат им, а не видео за ними. */
const DIALOGS = '[role="dialog"], .ant-modal-wrap, .ant-drawer'

/**
 * `true` — клавиша принадлежит элементу в фокусе, а не плееру.
 *
 * `player` — корень плеера, которому клавиша досталась бы. Модалка, в которой
 * лежит сам плеер, клавиши у него не забирает. `pointerMode` — плеером
 * пользуются мышью или пальцем: его кнопка в фокусе оказалась от клика, и
 * пробел после клика по «звуку» — это пауза, а не второй клик по «звуку».
 * С Tab кнопки плеера нажимаются пробелом, как любые кнопки.
 */
export function isHotkeyBlockedBy(
  element: Element | null,
  player: Element | null = null,
  pointerMode = false
): boolean {
  if (!element) return false
  if (element.closest(FORM_FIELDS)) return true
  const control = element.closest(INTERACTIVE)
  if (control) {
    // Фокус вне плеера — на чужой кнопке или ссылке.
    if (!player?.contains(element)) return true
    // Кнопка самого плеера, выбранная с Tab. Кнопка-предок плеера (карточка
    // поста целиком) не в счёт: фокус-то в плеере.
    if (player.contains(control) && !pointerMode) return true
  }
  const dialog = element.closest(DIALOGS)
  return !!dialog && !(player && dialog.contains(player))
}

/** Видна хотя бы половина плеера — тот же порог, что у авто-паузы при прокрутке. */
export function isOnScreen(element: Element | null): boolean {
  if (!element) return false
  const rect = element.getBoundingClientRect()
  const visible = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)
  return rect.height > 0 && visible >= rect.height * VISIBILITY_THRESHOLD
}
