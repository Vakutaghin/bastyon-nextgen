/**
 * Декодирование URL-encoded полей Bastyon (заголовок/текст поста, «о себе»,
 * блоки статей). Семантика — ровно legacy `trydecode` (pocketnet.gui
 * functionsfirst.js): `decodeURIComponent`, при ошибке — исходная строка.
 *
 * `+` НЕ трактуется как пробел: поля кодируются `encodeURIComponent`
 * (`articleEncode` в legacy), где литеральный `+` = `%2B`; вариант с
 * `replace(/\+/g, ' ')` ломал «C++» в некодированных записях. Единственная
 * реализация в проекте — остальные модули реэкспортируют её.
 */
export function safeDecode(str: string | null | undefined): string {
  if (!str) return ''
  try {
    return decodeURIComponent(str)
  } catch {
    return str
  }
}
