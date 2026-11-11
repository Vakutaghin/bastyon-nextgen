// Окно ленты: при открытии — последние FIRST_ROWS строк, дорисовка сверху по
// MORE_ROWS; начало закреплено (новое снизу не вытесняет верх), пока история
// грузится — не закрепляется; дорисовали всё — подгруженное сверху видно
// сразу; другая лента (чат, поиск) — снова последние строки. Открытие на
// строке (поиск): строки вокруг неё, дорисовка вниз, «к последним».

import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { FIRST_ROWS, FOCUS_AFTER, FOCUS_BEFORE, MORE_ROWS, useRowWindow } from './use-row-window'

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

  it('открыли на строке — над ней FOCUS_BEFORE, под ней FOCUS_AFTER', async () => {
    const { shown, hidden, hiddenBelow, focus } = setup(ids(0, 500))
    expect(focus('m200')).toBe(true)
    await nextTick()
    expect(shown.value[0]).toBe(`m${200 - FOCUS_BEFORE}`)
    expect(shown.value[shown.value.length - 1]).toBe(`m${200 + FOCUS_AFTER}`)
    expect(hidden.value).toBe(200 - FOCUS_BEFORE)
    expect(hiddenBelow.value).toBe(500 - 201 - FOCUS_AFTER)
  })

  it('такой строки нет — окно не меняется', () => {
    const { shown, focus } = setup(ids(0, 100))
    const before = shown.value
    expect(focus('nope')).toBe(false)
    expect(shown.value).toEqual(before)
  })

  it('у начала и у конца — до края ленты', async () => {
    const { shown, hiddenBelow, focus } = setup(ids(0, 100))
    focus('m3')
    await nextTick()
    expect(shown.value[0]).toBe('m0')
    focus('m95')
    await nextTick()
    expect(hiddenBelow.value).toBe(0)
    expect(shown.value[shown.value.length - 1]).toBe('m99')
  })

  it('дорисовка вниз по MORE_ROWS до конца; верх при этом не сдвигается', async () => {
    const { shown, hiddenBelow, focus, showNewer } = setup(ids(0, 500))
    focus('m100')
    await nextTick()
    const top = shown.value[0]
    showNewer()
    await nextTick()
    expect(shown.value[shown.value.length - 1]).toBe(`m${100 + FOCUS_AFTER + MORE_ROWS}`)
    expect(shown.value[0]).toBe(top)
    while (hiddenBelow.value > 0) showNewer()
    expect(shown.value[shown.value.length - 1]).toBe('m499')
  })

  it('новое сообщение снизу, пока лента открыта выше, — ждёт ниже', async () => {
    const { rows, hiddenBelow, focus } = setup(ids(0, 300))
    focus('m100')
    await nextTick()
    const below = hiddenBelow.value
    rows.value = [...rows.value, 'm300']
    await nextTick()
    expect(hiddenBelow.value).toBe(below + 1)
  })

  it('«к последним» — снова последние FIRST_ROWS', async () => {
    const { shown, hiddenBelow, focus, toBottom } = setup(ids(0, 300))
    focus('m100')
    await nextTick()
    toBottom()
    await nextTick()
    expect(hiddenBelow.value).toBe(0)
    expect(shown.value).toEqual(ids(300 - FIRST_ROWS, 300))
  })
})
