import {
  TARGET_RESOLUTIONS,
  MAX_RESOLUTION,
  MIN_RESOLUTION,
  type TargetResolution
} from '../utils/constants'

/**
 * Выбрать целевое разрешение на основе исходных размеров видео
 * Сохраняет пропорции, выбирает ближайшее доступное разрешение по высоте
 *
 * @param width Исходная ширина
 * @param height Исходная высота
 * @returns Целевое разрешение по высоте (144, 240, 360, 480, или 720)
 */
export function selectTargetResolution(
  width: number,
  height: number
): TargetResolution {
  if (width <= 0 || height <= 0) {
    return MIN_RESOLUTION
  }

  // Определяем ориентацию
  const isPortrait = height > width
  const sourceHeight = isPortrait ? width : height
  const sourceWidth = isPortrait ? height : width

  // Если исходное разрешение меньше минимального, возвращаем минимальное
  if (sourceHeight <= MIN_RESOLUTION) {
    return MIN_RESOLUTION
  }

  // Если исходное разрешение больше или равно максимальному, возвращаем максимальное
  if (sourceHeight >= MAX_RESOLUTION) {
    return MAX_RESOLUTION
  }

  // Находим ближайшее доступное разрешение
  let selectedResolution: TargetResolution = MIN_RESOLUTION
  let minDiff = Math.abs(sourceHeight - MIN_RESOLUTION)

  for (const resolution of TARGET_RESOLUTIONS) {
    const diff = Math.abs(sourceHeight - resolution)
    if (diff < minDiff) {
      minDiff = diff
      selectedResolution = resolution
    }
  }

  return selectedResolution
}

/**
 * Вычислить размеры для транскодирования с сохранением пропорций
 *
 * @param originalWidth Исходная ширина
 * @param originalHeight Исходная высота
 * @param targetHeight Целевая высота
 * @returns Объект с width и height
 */
export function calculateTargetDimensions(
  originalWidth: number,
  originalHeight: number,
  targetHeight: number
): { width: number; height: number } {
  if (originalWidth <= 0 || originalHeight <= 0) {
    return { width: targetHeight, height: targetHeight }
  }

  // Вычисляем пропорцию
  const aspectRatio = originalWidth / originalHeight

  // Вычисляем ширину на основе целевой высоты и пропорции
  const targetWidth = Math.round(targetHeight * aspectRatio)

  // Убеждаемся, что ширина четная (требование для некоторых кодеков)
  const evenWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth + 1
  const evenHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight + 1

  return {
    width: evenWidth,
    height: evenHeight
  }
}

/**
 * Получить строковое представление разрешения (например, "720p")
 */
export function getResolutionString(resolution: TargetResolution): string {
  return `${resolution}p`
}
