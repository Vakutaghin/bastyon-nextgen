/**
 * «Перейти к содержимому» — первая остановка Tab: шапку и левую панель
 * клавиатура проходит одним нажатием. Фокус уходит в область <main>
 * открытой страницы; tabindex=-1 позволяет поставить на неё фокус, не
 * добавляя её в обход Tab. Рамка фокуса у такой области не рисуется
 * (style.css): выделять весь экран незачем.
 */
export function focusMainContent(doc: Document = document): boolean {
  const main = doc.querySelector<HTMLElement>('main')
  if (!main) return false
  if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1')
  main.focus()
  return doc.activeElement === main
}
