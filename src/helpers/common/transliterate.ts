/**
 * Транслитерация русских букв в латинские
 */

const transliterationMap: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
  'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
  'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
  'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
  'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
  'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
  'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch',
  'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
}

/**
 * Транслитерирует русские буквы в латинские
 */
export function transliterate(text: string): string {
  return text
    .split('')
    .map((char) => transliterationMap[char] || char)
    .join('')
}

/**
 * Валидирует псевдоним (только латинские буквы, цифры и нижнее подчеркивание)
 */
export function validateNickname(nickname: string): boolean {
  return /^[a-zA-Z0-9_]+$/.test(nickname)
}

/**
 * Нормализует псевдоним: транслитерирует и оставляет только разрешенные символы
 */
export function normalizeNickname(text: string): string {
  // Транслитерируем
  let normalized = transliterate(text)
  
  // Оставляем только латинские буквы, цифры и нижнее подчеркивание
  normalized = normalized.replace(/[^a-zA-Z0-9_]/g, '')
  
  return normalized
}
