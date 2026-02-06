/**
 * Утилиты для работы с QR-кодами
 */

import QRCode from 'qrcode'

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
      `Failed to generate QR code: ${error instanceof Error ? error.message : String(error)}`
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
    errorCorrectionLevel: options.errorCorrectionLevel || 'H' as const,
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
    errorCorrectionLevel: options.errorCorrectionLevel || 'H' as const,
  }

  return generateQRCode(privateKey, qrOptions)
}

/**
 * Читает QR-код из изображения
 * @param image - Изображение (File, Blob, или data URL)
 * @returns Promise с данными из QR-кода
 */
export async function readQRCode(
  image: File | Blob | string
): Promise<string> {
  // Для чтения QR-кодов нужна библиотека для декодирования
  // В браузере можно использовать jsQR или другие библиотеки
  // Но для простоты, если это строка (data URL), возвращаем её
  // Для полноценного чтения нужно установить дополнительную библиотеку

  if (typeof image === 'string') {
    // Если это data URL, пытаемся извлечь данные
    // В реальной реализации здесь должен быть декодер QR-кодов
    throw new Error('QR code reading from string is not implemented. Use a QR code reader library.')
  }

  if (image instanceof File || image instanceof Blob) {
    // Конвертируем в data URL и затем декодируем
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        // Здесь должен быть декодер QR-кодов
        reject(new Error('QR code reading from File/Blob is not implemented. Use a QR code reader library.'))
      }
      reader.onerror = reject
      reader.readAsDataURL(image)
    })
  }

  throw new Error('Invalid image format. Expected File, Blob, or data URL string.')
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

  const {
    width = 300,
    errorCorrectionLevel = 'M',
  } = options

  try {
    const svg = await QRCode.toString(data, {
      type: 'svg',
      width,
      errorCorrectionLevel,
    })

    return svg
  } catch (error) {
    throw new Error(
      `Failed to generate QR code SVG: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
