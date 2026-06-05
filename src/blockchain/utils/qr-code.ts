/**
 * Утилиты для работы с QR-кодами
 */

import QRCode from 'qrcode'
import jsQR from 'jsqr'

/**
 * Генерирует QR-код из данных
 * @param data - Данные для кодирования (мнемоника, приватный ключ и т.д.)
 * @param options - Опции генерации QR-кода
 * @returns Promise с base64 строкой изображения QR-кода
 */
export async function generateQRCode(
  data: string,
  options: {
    /** Размер QR-кода в пикселях */
    width?: number
    /** Цвет фона (по умолчанию белый) */
    color?: {
      dark?: string
      light?: string
    }
    /** Уровень коррекции ошибок */
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
    /** Формат вывода (data URL или base64) */
    type?: 'data-url' | 'base64'
  } = {}
): Promise<string> {
  if (!data || typeof data !== 'string') {
    throw new Error('Data is required for QR code generation')
  }

  const {
    width = 300,
    color = { dark: '#000000', light: '#FFFFFF' },
    errorCorrectionLevel = 'M',
    type = 'data-url',
  } = options

  try {
    const qrOptions: QRCode.QRCodeToDataURLOptions = {
      width,
      color,
      errorCorrectionLevel,
      type: 'image/png',
    }

    const dataUrl = await QRCode.toDataURL(data, qrOptions)

    if (type === 'base64') {
      // Извлекаем base64 часть из data URL
      const base64Match = dataUrl.match(/^data:image\/[^;]+;base64,(.+)$/)
      if (base64Match && base64Match[1]) {
        return base64Match[1]
      }
      throw new Error('Failed to extract base64 from data URL')
    }

    return dataUrl
  } catch (error) {
    throw new Error(
      `Failed to generate QR code: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    )
  }
}

/**
 * Генерирует QR-код для мнемонической фразы
 * @param mnemonic - Мнемоническая фраза
 * @param options - Опции генерации
 * @returns Promise с base64 строкой изображения QR-кода
 */
export async function generateMnemonicQRCode(
  mnemonic: string,
  options: {
    width?: number
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
  } = {}
): Promise<string> {
  if (!mnemonic) {
    throw new Error('Mnemonic is required')
  }

  // Используем высокий уровень коррекции ошибок для мнемоники
  const qrOptions = {
    ...options,
    errorCorrectionLevel: options.errorCorrectionLevel || ('H' as const),
  }

  return generateQRCode(mnemonic, qrOptions)
}

/**
 * Генерирует QR-код для приватного ключа
 * @param privateKey - Приватный ключ (hex, WIF или мнемоника)
 * @param options - Опции генерации
 * @returns Promise с base64 строкой изображения QR-кода
 */
export async function generatePrivateKeyQRCode(
  privateKey: string,
  options: {
    width?: number
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
  } = {}
): Promise<string> {
  if (!privateKey) {
    throw new Error('Private key is required')
  }

  // Используем высокий уровень коррекции ошибок для приватного ключа
  const qrOptions = {
    ...options,
    errorCorrectionLevel: options.errorCorrectionLevel || ('H' as const),
  }

  return generateQRCode(privateKey, qrOptions)
}

/**
 * Декодирует QR-код из сырых пиксельных данных (RGBA).
 * Чистая функция-обёртка над jsQR — тестируема без DOM/canvas.
 *
 * @param data - Пиксели изображения в формате RGBA (Uint8ClampedArray)
 * @param width - Ширина изображения в пикселях
 * @param height - Высота изображения в пикселях
 * @returns Декодированный текст или null, если QR-код не найден
 */
export function decodeQRFromImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number
): string | null {
  if (!data || width <= 0 || height <= 0) return null
  const result = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' })
  return result?.data ?? null
}

/** Загружает источник изображения (data/object URL) в HTMLImageElement. */
function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('qr:decode:image_load_failed'))
    img.src = src
  })
}

/**
 * Читает (декодирует) QR-код из изображения.
 *
 * Рендерит изображение на offscreen-canvas, извлекает пиксели и декодирует через
 * jsQR. Работает в браузерной среде (DOM + canvas 2D). В окружениях без canvas
 * (node/тесты на happy-dom) бросает `qr:decode:unsupported_environment` — для
 * таких сред используйте {@link decodeQRFromImageData} напрямую.
 *
 * @param image - Изображение (File, Blob, или data/object URL строка)
 * @returns Promise с декодированным текстом (например, мнемоника/приватный ключ)
 * @throws `Invalid image format` — неподдерживаемый тип входных данных
 * @throws `qr:decode:unsupported_environment` — нет DOM/canvas
 * @throws `qr:decode:failed` — QR-код не распознан в изображении
 */
export async function readQRCode(image: File | Blob | string): Promise<string> {
  // 1) Валидация формата входа — синхронно, до любых side-effect'ов.
  const isString = typeof image === 'string'
  const isBlob = typeof Blob !== 'undefined' && image instanceof Blob // File наследует Blob
  if (!isString && !isBlob) {
    throw new Error('Invalid image format. Expected File, Blob, or data URL string.')
  }

  // 2) Проверяем доступность canvas 2D ДО загрузки изображения, иначе в средах
  //    без рендеринга (happy-dom) промис загрузки Image мог бы зависнуть.
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    throw new Error('qr:decode:unsupported_environment')
  }
  const canvas = document.createElement('canvas')
  const probeCtx = canvas.getContext('2d')
  if (!probeCtx) {
    throw new Error('qr:decode:unsupported_environment')
  }

  // 3) Готовим источник: строку используем как есть, Blob/File — через object URL.
  let src: string
  let revoke: (() => void) | null = null
  if (isString) {
    src = image
  } else {
    src = URL.createObjectURL(image as Blob)
    revoke = () => URL.revokeObjectURL(src)
  }

  try {
    const img = await loadImageElement(src)
    const width = img.naturalWidth || img.width
    const height = img.naturalHeight || img.height
    if (!width || !height) {
      throw new Error('qr:decode:failed')
    }
    canvas.width = width
    canvas.height = height
    probeCtx.drawImage(img, 0, 0, width, height)
    const { data } = probeCtx.getImageData(0, 0, width, height)

    const text = decodeQRFromImageData(data, width, height)
    if (!text) {
      throw new Error('qr:decode:failed')
    }
    return text
  } finally {
    revoke?.()
  }
}

/**
 * Создает data URL для QR-кода (для использования в img src)
 * @param data - Данные для кодирования
 * @param options - Опции генерации
 * @returns Promise с data URL
 */
export async function generateQRCodeDataURL(
  data: string,
  options: {
    width?: number
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
  } = {}
): Promise<string> {
  return generateQRCode(data, {
    ...options,
    type: 'data-url',
  })
}

/**
 * Создает SVG QR-код
 * @param data - Данные для кодирования
 * @param options - Опции генерации
 * @returns Promise с SVG строкой
 */
export async function generateQRCodeSVG(
  data: string,
  options: {
    width?: number
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
  } = {}
): Promise<string> {
  if (!data || typeof data !== 'string') {
    throw new Error('Data is required for QR code generation')
  }

  const { width = 300, errorCorrectionLevel = 'M' } = options

  try {
    const svg = await QRCode.toString(data, {
      type: 'svg',
      width,
      errorCorrectionLevel,
    })

    return svg
  } catch (error) {
    throw new Error(
      `Failed to generate QR code SVG: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    )
  }
}
