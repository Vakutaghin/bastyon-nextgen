/**
 * Генерирует нейтральный, нежный цвет на основе строки
 * Цвета будут мягкими, не бросающимися в глаза, но с различными оттенками
 */
export function generateNeutralColor(seed?: string): string {
  // Если есть seed (например, адрес пользователя), используем его для детерминированного цвета
  // Если нет, генерируем случайный
  let hash = 0
  if (seed) {
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash)
    }
  } else {
    // Случайный seed, если ничего не передано
    hash = Math.random() * 1000000
  }

  // Генерируем мягкие, пастельные цвета
  // Используем HSL для лучшего контроля над насыщенностью и яркостью
  
  // Hue: 0-360 (оттенок) - используем широкий диапазон для разнообразия
  const hue = Math.abs(hash) % 360
  
  // Saturation: 15-35% (низкая насыщенность для нежности)
  const saturation = 15 + (Math.abs(hash * 7) % 20)
  
  // Lightness: 75-90% (высокая яркость для мягкости)
  const lightness = 75 + (Math.abs(hash * 11) % 15)

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

/**
 * Генерирует цвет текста (белый или темный) в зависимости от яркости фона
 */
export function getContrastTextColor(backgroundColor: string): string {
  // Для светлых пастельных цветов используем темный текст
  // Извлекаем lightness из HSL
  const match = backgroundColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
  if (match) {
    const lightness = parseInt(match[3])
    // Если яркость больше 80%, используем темный текст
    return lightness > 80 ? '#333333' : '#ffffff'
  }
  // По умолчанию темный текст для светлых фонов
  return '#333333'
}
