// Окно ленты: при открытии — последние FIRST_ROWS строк, дорисовка сверху по
// MORE_ROWS; начало закреплено (новое снизу не вытесняет верх), пока история
// грузится — не закрепляется; дорисовали всё — подгруженное сверху видно
// сразу; другая лента (чат, поиск) — снова последние строки.

import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { FIRST_ROWS, MORE_ROWS, useRowWindow } from './use-row-window'

const ids = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, i) => `m${from + i}`)

function setup(initial: string[]) {
  const rows = ref<string[]>(initial)
  const key = ref('chat-a')
  const window = useRowWindow(
    rows,
    (row) => row,
    () => key.value
  )
  return { rows, key, ...window }
}

describe('useRowWindow', () => {
  it('короткая лента — целиком', () => {
    const { shown, hidden } = setup(ids(0, 10))
    expect(shown.value).toHaveLength(10)
    expect(hidden.value).toBe(0)
  })

  it('длинная — последние FIRST_ROWS, дорисовка по MORE_ROWS до начала', () => {
    const { shown, hidden, showMore } = setup(ids(0, 150))
    expect(shown.value).toEqual(ids(150 - FIRST_ROWS, 150))
    expect(hidden.value).toBe(150 - FIRST_ROWS)
    showMore()
    expect(shown.value[0]).toBe(`m${150 - FIRST_ROWS - MORE_ROWS}`)
    showMore()
    showMore()
    expect(hidden.value).toBe(0)
    showMore()
    expect(shown.value).toHaveLength(150)
  })

  it('новое сообщение снизу не вытесняет верхнюю строку', async () => {
    const { rows, shown } = setup(ids(0, 100))
    await nextTick()
    const top = shown.value[0]
    rows.value = [...rows.value, 'm100', 'm101']
    await nextTick()
    expect(shown.value[0]).toBe(top)
    expect(shown.value[shown.value.length - 1]).toBe('m101')
  })

  it('история грузится частями: не закрепляется, пока всё влезает', async () => {
    const { rows, shown } = setup(ids(130, 150))
    await nextTick()
    expect(shown.value).toHaveLength(20)
    rows.value = ids(0, 150)
    await nextTick()
    expect(shown.value).toEqual(ids(150 - FIRST_ROWS, 150))
  })

  it('история сверху ждёт прокрутки; после дорисовки до начала — видна сразу', async () => {
    const { rows, shown, hidden, showMore } = setup(ids(50, 150))
    await nextTick()
    rows.value = [...ids(0, 50), ...rows.value]
    await nextTick()
    expect(shown.value[0]).toBe(`m${150 - FIRST_ROWS}`)
    while (hidden.value > 0) showMore()
    rows.value = [...ids(-20, 0), ...rows.value]
    await nextTick()
    expect(shown.value[0]).toBe('m-20')
  })

  it('удалили верхнее сообщение — начало закрепляется по новой первой строке', async () => {
    const { rows, shown } = setup(ids(0, 100))
    await nextTick()
    const top = shown.value[0]!
    rows.value = rows.value.filter((row) => row !== top)
    await nextTick()
    expect(shown.value).toHaveLength(FIRST_ROWS)
    rows.value = [...rows.value, 'm100']
    await nextTick()
    expect(shown.value).toHaveLength(FIRST_ROWS + 1)
  })

  it('другая лента — снова последние FIRST_ROWS', async () => {
    const { rows, key, shown, showMore } = setup(ids(0, 150))
    showMore()
    await nextTick()
    key.value = 'chat-b'
    rows.value = ids(1000, 1200)
    await nextTick()
    expect(shown.value).toEqual(ids(1200 - FIRST_ROWS, 1200))
  })
})
