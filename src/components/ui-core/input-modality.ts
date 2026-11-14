/**
 * Чем человек действовал последним — клавиатурой или указателем. Подсказка по
 * фокусу открывается только после клавиатуры: касание кнопки на телефоне тоже
 * даёт ей фокус, и без этой проверки подсказка выскакивала бы после каждого
 * нажатия (`:focus-visible` в `matches` нет у Safari до 15.4).
 */

let last: 'keyboard' | 'pointer' = 'pointer'
let installed = false

function install(): void {
  if (installed || typeof document === 'undefined') return
  installed = true
  document.addEventListener('keydown', () => (last = 'keyboard'), true)
  document.addEventListener('pointerdown', () => (last = 'pointer'), true)
}

/** Начать следить; вызывать при создании компонента, до первого фокуса. */
export function trackInputModality(): void {
  install()
}

export function lastInputWasKeyboard(): boolean {
  install()
  return last === 'keyboard'
}
