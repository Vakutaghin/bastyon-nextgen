// Поворот, кроп и фильтры картинок в редакторе композера: размеры холста,
// формат и качество на выходе, отказ загрузки и браузер без 2D-контекста.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { installCanvasFakes, type CanvasFakes } from '@/helpers/common/testing/canvas-fakes'
import { rotateBase64, applyCropFilter, FILTER_PRESETS } from './image-transform'

const JPEG = 'data:image/jpeg;base64,AAAA'
const PNG = 'data:image/png;base64,BBBB'
const WEBP = 'data:image/webp;base64,CCCC'

let fakes: CanvasFakes

beforeEach(() => {
  fakes = installCanvasFakes()
  fakes.sizes.set(JPEG, { width: 400, height: 300 })
  fakes.sizes.set(PNG, { width: 400, height: 300 })
  fakes.sizes.set(WEBP, { width: 400, height: 300 })
})

afterEach(() => fakes.restore())

describe('rotateBase64', () => {
  it('0° и полный оборот — картинка как была, холст не нужен', async () => {
    expect(await rotateBase64(JPEG, 0)).toBe(JPEG)
    expect(await rotateBase64(JPEG, 360)).toBe(JPEG)
    expect(await rotateBase64(JPEG, -720)).toBe(JPEG)
    expect(fakes.canvases).toHaveLength(0)
  })

  it('90° — стороны меняются местами, поворот вокруг центра', async () => {
    const out = await rotateBase64(JPEG, 90)
    const [canvas] = fakes.canvases
    expect(canvas!.width).toBe(300)
    expect(canvas!.height).toBe(400)
    expect(canvas!.ctx!.calls).toEqual([
      ['translate', 150, 200],
      ['rotate', Math.PI / 2],
      ['drawImage', expect.anything(), -200, -150],
    ])
    expect(out).toBe('data:image/jpeg;q=0.9;300x400')
  })

  it('180° — размеры прежние', async () => {
    await rotateBase64(PNG, 180)
    expect(fakes.canvases[0]).toMatchObject({ width: 400, height: 300 })
    expect(fakes.canvases[0]!.ctx!.calls[1]).toEqual(['rotate', Math.PI])
  })

  it('угол округляется до четверти оборота, против часовой — как 270°', async () => {
    await rotateBase64(PNG, -90)
    expect(fakes.canvases[0]!.ctx!.calls[1]).toEqual(['rotate', (270 * Math.PI) / 180])
    await rotateBase64(PNG, 100)
    expect(fakes.canvases[1]!.ctx!.calls[1]).toEqual(['rotate', Math.PI / 2])
  })

  it('формат сохраняется; качество задаётся только JPEG', async () => {
    expect(await rotateBase64(PNG, 90)).toBe('data:image/png;q=-;300x400')
    expect(await rotateBase64(WEBP, 90)).toBe('data:image/webp;q=-;300x400')
  })

  it('без формата в data-URL — PNG, чтобы не потерять прозрачность', async () => {
    const odd = 'data:;base64,DDDD'
    fakes.sizes.set(odd, { width: 10, height: 20 })
    expect(await rotateBase64(odd, 90)).toBe('data:image/png;q=-;20x10')
  })

  it('картинка не декодировалась — ошибка, а не пустой холст', async () => {
    await expect(rotateBase64('data:image/jpeg;base64,broken', 90)).rejects.toThrow(
      'image_load_failed'
    )
  })

  it('нет 2D-контекста — отдаёт исходник', async () => {
    fakes.noContextOnce()
    expect(await rotateBase64(JPEG, 90)).toBe(JPEG)
  })
})

describe('applyCropFilter', () => {
  it('без кропа и фильтра — исходник без перекодирования', async () => {
    expect(await applyCropFilter(JPEG, null, 'none')).toBe(JPEG)
    expect(await applyCropFilter(JPEG, { x: 0, y: 0, w: 100, h: 100 }, '')).toBe(JPEG)
    expect(fakes.canvases).toHaveLength(0)
  })

  it('кроп в процентах вырезает нужный кусок в холст его размера', async () => {
    const out = await applyCropFilter(JPEG, { x: 25, y: 10, w: 50, h: 50 }, 'none')
    const [canvas] = fakes.canvases
    expect(canvas).toMatchObject({ width: 200, height: 150 })
    expect(canvas!.ctx!.calls).toEqual([
      ['drawImage', expect.anything(), 100, 30, 200, 150, 0, 0, 200, 150],
    ])
    expect(canvas!.ctx!.filter).toBe('none')
    expect(out).toBe('data:image/jpeg;q=0.9;200x150')
  })

  it('фильтр без кропа — вся картинка с фильтром холста', async () => {
    const sepia = FILTER_PRESETS.find((p) => p.key === 'sepia')!.css
    await applyCropFilter(PNG, null, sepia)
    const [canvas] = fakes.canvases
    expect(canvas).toMatchObject({ width: 400, height: 300 })
    expect(canvas!.ctx!.filter).toBe(sepia)
    expect(canvas!.ctx!.calls[0]).toEqual([
      'drawImage',
      expect.anything(),
      0,
      0,
      400,
      300,
      0,
      0,
      400,
      300,
    ])
  })

  it('значения за пределами 0..100 прижимаются; кусок не меньше пикселя', async () => {
    await applyCropFilter(JPEG, { x: -20, y: 150, w: 0, h: 300 }, 'none')
    const [canvas] = fakes.canvases
    expect(canvas!.ctx!.calls[0]).toEqual([
      'drawImage',
      expect.anything(),
      0,
      300,
      1,
      300,
      0,
      0,
      1,
      300,
    ])
  })

  it('картинка не декодировалась — ошибка', async () => {
    await expect(
      applyCropFilter('data:image/png;base64,broken', null, 'grayscale(1)')
    ).rejects.toThrow('image_load_failed')
  })

  it('нет 2D-контекста — отдаёт исходник', async () => {
    fakes.noContextOnce()
    expect(await applyCropFilter(PNG, { x: 10, y: 10, w: 50, h: 50 }, 'none')).toBe(PNG)
  })

  it('у каждого пресета свой ключ и подпись, «без фильтра» — первый', () => {
    expect(FILTER_PRESETS[0]).toMatchObject({ key: 'none', css: 'none' })
    const keys = FILTER_PRESETS.map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const preset of FILTER_PRESETS) expect(preset.labelKey).toMatch(/^imageEditor\./)
  })
})
