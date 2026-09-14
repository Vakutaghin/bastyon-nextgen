// Пробрасывание объявленных пропсов обёртки в компонент antd (аудит X8:
// K6/V13/S63). Обёртки в src/components объявляют antd-пропсы через
// defineProps ради типизации — но объявленный проп исчезает из $attrs, и
// `v-bind="$attrs"` его уже не доносит: @search, type="password", title,
// footer терялись молча. Правило для всех обёрток:
//   - `inheritAttrs: false`, в antd уходит `{ ...$attrs, ...definedProps(p) }`;
//   - boolean-пропсы объявляются с default `undefined` (иначе Vue кастует
//     отсутствие в `false` и перебивает дефолт antd);
//   - слоты antd прокидываются только если их дал потребитель (пустой слот
//     antd трактует как «контент есть» и не рисует свой дефолт).

/** Только реально заданные пропсы (`undefined` = потребитель не передавал). */
export function definedProps<T extends object>(
  p: T,
  omit: ReadonlyArray<keyof T> = []
): Partial<T> {
  const out: Partial<T> = {}
  for (const key of Object.keys(p) as Array<keyof T>) {
    if (omit.includes(key)) continue
    const value = p[key]
    if (value !== undefined) out[key] = value
  }
  return out
}
