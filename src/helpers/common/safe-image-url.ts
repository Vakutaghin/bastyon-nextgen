// Безопасный URL картинки из недоверенных данных блокчейна (обложка профиля
// `accSet.cover`, аудит V16). Раньше строка вставлялась в styled как
// `background-image: url(${image})` — `)` закрывал url(, `}` — правило, дальше
// шёл любой CSS (дефейс, UI-redress, пиксель на https:). Теперь значение идёт
// в `<img :src>` (атрибут, не CSS), а сюда — строгая валидация: голый хеш →
// полный URL, `new URL`, только http(s), сериализованный href.
import { resolveImageUrl } from './url-transformer'

/** http(s)-href картинки или null, если значение не URL/хеш картинки. */
export function safeHttpImageUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null
  const value = raw.trim()
  // Не URL и не похоже на хеш картинки (схема/путь внутри) — не подставляем.
  if (!/^https?:\/\//i.test(value) && /[:/\\]/.test(value)) return null
  const resolved = resolveImageUrl(value)
  if (!resolved) return null
  let parsed: URL
  try {
    parsed = new URL(resolved)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  return parsed.href
}
