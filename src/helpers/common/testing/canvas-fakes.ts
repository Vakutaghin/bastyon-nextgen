// Заменители Image и canvas для тестов обработки картинок: в happy-dom нет
// декодера и 2D-контекста. Картинка «грузится» по размерам из реестра, canvas
// записывает вызовы, toDataURL отдаёт строку с форматом, качеством и размером.

import { vi } from 'vitest'

export interface FakeContext {
  calls: Array<[string, ...unknown[]]>
  filter: string
}

export interface FakeCanvas {
  width: number
  height: number
  ctx: FakeContext | null
  dataUrlCalls: Array<[string | undefined, number | undefined]>
  getContext(type: string): FakeContext | null
  toDataURL(type?: string, quality?: number): string
}

export interface CanvasFakes {
  /** Размеры, которые «декодер» вернёт для data-URL; без записи — ошибка загрузки. */
  sizes: Map<string, { width: number; height: number }>
  canvases: FakeCanvas[]
  /** Следующий canvas — без 2D-контекста. */
  noContextOnce(): void
  /** Следующий toDataURL бросит (tainted canvas). */
  throwOnceOnExport(): void
  restore(): void
}

export function installCanvasFakes(): CanvasFakes {
  const sizes = new Map<string, { width: number; height: number }>()
  const canvases: FakeCanvas[] = []
  let noContext = false
  let throwOnExport = false

  class FakeImage {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    width = 0
    height = 0
    naturalWidth = 0
    naturalHeight = 0
    private _src = ''
    get src(): string {
      return this._src
    }
    set src(value: string) {
      this._src = value
      queueMicrotask(() => {
        const size = sizes.get(value)
        if (!size) {
          this.onerror?.()
          return
        }
        this.width = this.naturalWidth = size.width
        this.height = this.naturalHeight = size.height
        this.onload?.()
      })
    }
  }

  const originalImage = globalThis.Image
  globalThis.Image = FakeImage as unknown as typeof Image

  const originalCreate = document.createElement.bind(document)
  const create = vi.spyOn(document, 'createElement').mockImplementation(((
    tag: string,
    options?: ElementCreationOptions
  ) => {
    if (tag !== 'canvas') return originalCreate(tag, options)
    const withoutContext = noContext
    noContext = false
    const ctx: FakeContext = {
      calls: [],
      filter: 'none',
    }
    const recorder = new Proxy(ctx, {
      get(target, prop) {
        if (prop in target) return target[prop as keyof FakeContext]
        return (...args: unknown[]) => target.calls.push([String(prop), ...args])
      },
      set(target, prop, value) {
        if (prop === 'filter') target.filter = String(value)
        return true
      },
    })
    const canvas: FakeCanvas = {
      width: 300,
      height: 150,
      ctx: withoutContext ? null : ctx,
      dataUrlCalls: [],
      getContext: () => (withoutContext ? null : recorder),
      toDataURL(type?: string, quality?: number) {
        canvas.dataUrlCalls.push([type, quality])
        if (throwOnExport) {
          throwOnExport = false
          throw new Error('SecurityError: tainted canvas')
        }
        return `data:${type ?? 'image/png'};q=${quality ?? '-'};${canvas.width}x${canvas.height}`
      },
    }
    canvases.push(canvas)
    return canvas as unknown as HTMLCanvasElement
  }) as typeof document.createElement)

  return {
    sizes,
    canvases,
    noContextOnce: () => {
      noContext = true
    },
    throwOnceOnExport: () => {
      throwOnExport = true
    },
    restore: () => {
      globalThis.Image = originalImage
      create.mockRestore()
    },
  }
}
