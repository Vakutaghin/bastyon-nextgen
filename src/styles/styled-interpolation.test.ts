// Компонент как селектор в шаблоне стилей (подстановка SC_Child, за ней
// блок правил) — приём styled-components для React. vue3-styled-components его не знает: компонент
// для него обычный объект, и в CSS уходят его поля вместе с исходным кодом
// функций. Такой текст ломает разбор всего общего <style>, где по 40
// компонентов, и стили соседей пропадают — так с выбранным тегом в боковой
// панели рассыпалась шапка. Часть дочернего компонента стилизуют по классу
// части (`.ui-tags__count`), а не подстановкой компонента.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')
// Все styled-компоненты проекта называются SC_*; подставлять их в шаблон
// незачем нигде, кроме как селектором, — значит, любое вхождение — ошибка.
const COMPONENT_INTERPOLATION = /\$\{\s*SC_[A-Za-z0-9_]*\s*\}/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return sourceFiles(p)
    return /\.(vue|ts|tsx|js)$/.test(e.name) ? [p] : []
  })
}

describe('шаблоны styled-компонентов', () => {
  it('не подставляют styled-компонент как селектор', () => {
    const found = ['src', 'src-mobile']
      .flatMap((d) => sourceFiles(join(ROOT, d)))
      .flatMap((f) =>
        readFileSync(f, 'utf8')
          .split('\n')
          .map((line, i) => ({ line, at: `${relative(ROOT, f).replace(/\\/g, '/')}:${i + 1}` }))
          .filter(({ line }) => COMPONENT_INTERPOLATION.test(line))
          .map(({ at }) => at)
      )
    expect(found).toEqual([])
  })
})
