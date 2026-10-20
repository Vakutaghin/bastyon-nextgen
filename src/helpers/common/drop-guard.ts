/**
 * Файл, брошенный на окно мимо мест для файлов, WebView открывает вместо
 * страницы: видео заменяло собой приложение. Файлы принимают только свои зоны
 * (окно загрузки видео, плитка «+» у картинок поста, чат) — они гасят
 * dragover и drop сами. Всё, что дошло до window непогашенным, гасим здесь, и
 * курсор показывает, что сюда бросать нельзя.
 *
 * Текст и ссылку можно, как и раньше, перетащить в поле ввода: там это
 * вставка, а не переход. Бросок на iframe (мини-приложение, ролик) сюда не
 * доходит — его держит запрет `file:` в окне (src-tauri/src/main_window.rs).
 */

const carriesFiles = (event: DragEvent): boolean =>
  Array.from(event.dataTransfer?.types ?? []).includes('Files')

/** Поле, куда браузер сам вставит перетащенный текст. */
const isTextField = (target: EventTarget | null): boolean => {
  if (target instanceof HTMLTextAreaElement) return true
  if (target instanceof HTMLInputElement) return target.type !== 'file'
  return target instanceof HTMLElement && target.isContentEditable
}

/** Бросок, который никто из зон не принял и который браузер превратит в переход. */
const isStray = (event: DragEvent): boolean =>
  !event.defaultPrevented && (carriesFiles(event) || !isTextField(event.target))

const onDragOver = (event: DragEvent): void => {
  if (!isStray(event)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'none'
}

const onDrop = (event: DragEvent): void => {
  if (isStray(event)) event.preventDefault()
}

let installed = false

/** Один раз на запуск, до монтирования приложения. */
export function installDropGuard(target: Window = window): void {
  if (installed) return
  installed = true
  target.addEventListener('dragover', onDragOver)
  target.addEventListener('drop', onDrop)
}
