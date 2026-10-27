/**
 * Экранная клавиатура телефона на экране? Пока она открыта, нижняя панель
 * разделов прячется — место нужнее тексту, — а отступ под полосу жестов
 * снимается: клавиатура её закрывает. Для CSS — `<html data-keyboard="open">`.
 *
 * Признаки два. В нативной сборке — события плагина Keyboard (Capacitor).
 * В браузере телефона их нет: там клавиатура видна по высоте видимой области
 * (visualViewport), которая заметно ниже обычной, пока в фокусе поле ввода.
 */

/** Меньше — не клавиатура, а, например, строка адреса браузера (~56 px). */
export const KEYBOARD_MIN_HEIGHT = 150

const NON_TEXT_INPUTS = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
])

let open = false
let started = false

/** Поле, в которое печатают с клавиатуры. */
export function isTextField(el: Element | null): boolean {
  if (!el) return false
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled
  if (el instanceof HTMLInputElement) {
    return !el.readOnly && !el.disabled && !NON_TEXT_INPUTS.has(el.type)
  }
  return (el as HTMLElement).isContentEditable === true
}

function setOpen(value: boolean): void {
  if (open === value) return
  open = value
  const root = document.documentElement
  if (value) root.dataset.keyboard = 'open'
  else delete root.dataset.keyboard
}

async function watchNative(): Promise<boolean> {
  try {
    const core = await import('@capacitor/core')
    if (!core.Capacitor?.isNativePlatform?.()) return false
    const { Keyboard } = await import('@capacitor/keyboard')
    await Keyboard.addListener('keyboardWillShow', () => setOpen(true))
    await Keyboard.addListener('keyboardWillHide', () => setOpen(false))
    return true
  } catch {
    return false
  }
}

function watchViewport(): void {
  const vv = window.visualViewport
  if (!vv) return
  // Высота без клавиатуры — наибольшая при этой ширине окна; поворот её сбрасывает.
  let width = window.innerWidth
  let fullHeight = vv.height

  const check = (): void => {
    if (window.innerWidth !== width) {
      width = window.innerWidth
      fullHeight = vv.height
    }
    // Увеличение пальцами тоже уменьшает видимую область — это не клавиатура.
    if (vv.scale > 1.01) return
    fullHeight = Math.max(fullHeight, vv.height)
    setOpen(isTextField(document.activeElement) && fullHeight - vv.height >= KEYBOARD_MIN_HEIGHT)
  }

  vv.addEventListener('resize', check)
  document.addEventListener('focusin', check)
  // Фокус ушёл из поля: activeElement обновится после события.
  document.addEventListener('focusout', () => window.setTimeout(check, 0))
}

/** Следить за клавиатурой: один раз на приложение (app-layout). */
export function watchSoftKeyboard(): void {
  if (started || typeof window === 'undefined') return
  started = true
  void watchNative().then((native) => {
    if (!native) watchViewport()
  })
}
