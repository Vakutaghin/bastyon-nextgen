// Заменители Image и canvas для тестов обработки картинок: в happy-dom нет
// декодера и 2D-контекста. Картинка «грузится» по размерам из реестра, canvas
// записывает вызовы, toDataURL отдаёт строку с форматом, качеством и размером,
// toBlob — Blob с той же строкой (или заданного размера).

import { vi } from 'vitest'

export interface FakeContext {
  calls: Array<[string, ...unknown[]]>
  filter: string
  /** Прочие свойства, которые код ставил контексту (fillStyle и т.п.). */
  props: Record<string, unknown>
}

export interface FakeCanvas {
  width: number
  height: number
  ctx: FakeContext | null
  dataUrlCalls: Array<[string | undefined, number | undefined]>
  blobCalls: Array<[string | undefined, number | undefined]>
  getContext(type: string): FakeContext | null
  toDataURL(type?: string, quality?: number): string
  toBlob(callback: (blob: Blob | null) => void, type?: string, quality?: number): void
}

export interface CanvasFakes {
  /** Размеры, которые «декодер» вернёт для data-URL; без записи — ошибка загрузки. */
  sizes: Map<string, { width: number; height: number }>
  canvases: FakeCanvas[]
  /** Следующий canvas — без 2D-контекста. */
  noContextOnce(): void
  /** Следующий toDataURL бросит (tainted canvas). */
  throwOnceOnExport(): void
  /** Картинки (data-URL) с прозрачными пикселями — их отдаст getImageData. */
  transparent: Set<string>
  /**
   * Тело экспорта: задано — toDataURL отдаёт настоящий base64 data-URL с этим
   * телом (размер важен, когда код сравнивает его с оригиналом).
   */
  exportBody: ((type: string, width: number, height: number) => string) | null
  /** Размер Blob из toBlob, байт; не задан — Blob со строкой формата, качества и размера. */
  blobSize: ((type: string, width: number, height: number) => number) | null
  restore(): void
}

export function installCanvasFakes(): CanvasFakes {
  const sizes = new Map<string, { width: number; height: number }>()
  const canvases: FakeCanvas[] = []
  let noContext = false
  let throwOnExport = false
  const transparent = new Set<string>()
  const fakes = {
    exportBody: null as CanvasFakes['exportBody'],
    blobSize: null as CanvasFakes['blobSize'],
  }

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
      props: {},
    }
    // Последняя нарисованная картинка — по ней getImageData решает о прозрачности.
    let drawn = ''
    const recorder = new Proxy(ctx, {
      get(target, prop) {
        if (prop === 'getImageData') {
          return (...args: unknown[]) => {
            target.calls.push(['getImageData', ...args])
            const alpha = transparent.has(drawn) ? 0 : 255
            return { data: Uint8ClampedArray.of(255, 255, 255, 255, 255, 255, 255, alpha) }
          }
        }
        if (prop in target) return target[prop as keyof FakeContext]
        return (...args: unknown[]) => {
          if (prop === 'drawImage') drawn = String((args[0] as { src?: string })?.src ?? '')
          target.calls.push([String(prop), ...args])
        }
      },
      set(target, prop, value) {
        if (prop === 'filter') target.filter = String(value)
        else target.props[String(prop)] = value
        return true
      },
    })
    const canvas: FakeCanvas = {
      width: 300,
      height: 150,
      ctx: withoutContext ? null : ctx,
      dataUrlCalls: [],
      blobCalls: [],
      getContext: () => (withoutContext ? null : recorder),
      toBlob(callback, type, quality) {
        canvas.blobCalls.push([type, quality])
        const mime = type ?? 'image/png'
        const body = fakes.blobSize
          ? new Uint8Array(fakes.blobSize(mime, canvas.width, canvas.height))
          : `${mime};q=${quality ?? '-'};${canvas.width}x${canvas.height}`
        queueMicrotask(() => callback(new Blob([body], { type: mime })))
      },
      toDataURL(type?: string, quality?: number) {
        canvas.dataUrlCalls.push([type, quality])
        if (throwOnExport) {
          throwOnExport = false
          throw new Error('SecurityError: tainted canvas')
        }
        const mime = type ?? 'image/png'
        if (fakes.exportBody) {
          return `data:${mime};base64,${fakes.exportBody(mime, canvas.width, canvas.height)}`
        }
        return `data:${mime};q=${quality ?? '-'};${canvas.width}x${canvas.height}`
      },
    }
    canvases.push(canvas)
    return canvas as unknown as HTMLCanvasElement
  }) as typeof document.createElement)

  return {
    sizes,
    canvases,
    transparent,
    get exportBody() {
      return fakes.exportBody
    },
    set exportBody(value) {
      fakes.exportBody = value
    },
    get blobSize() {
      return fakes.blobSize
    },
    set blobSize(value) {
      fakes.blobSize = value
    },
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
