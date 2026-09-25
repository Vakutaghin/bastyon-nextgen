/**
 * Копирование в буфер обмена.
 *
 * `copySecret` — для сида и приватного ключа: через минуту буфер очищается,
 * чтобы секрет не лежал там бесконечно (N6). Очищаем только если окно
 * приложения в этот момент в фокусе: если человек ушёл в другое приложение,
 * он мог уже скопировать там что-то своё — затирать это нельзя. Прочитать
 * буфер и сравнить без системного запроса разрешения в вебвью нельзя, поэтому
 * фокус — единственный безопасный признак «буфер всё ещё наш».
 */

export const SECRET_CLIPBOARD_TTL_MS = 60_000

let secretClearTimer: ReturnType<typeof setTimeout> | null = null

/** Копирует текст; `false`, если ни Clipboard API, ни запасной путь не сработали. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Запасной путь для контекстов без Clipboard API (старые WebView, file://).
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.select()
    try {
      return document.execCommand('copy')
    } catch {
      return false
    } finally {
      document.body.removeChild(textArea)
    }
  }
}

async function clearSecretIfStillOurs(): Promise<void> {
  secretClearTimer = null
  if (!document.hasFocus()) return
  try {
    await navigator.clipboard.writeText('')
  } catch {
    /* буфер недоступен — оставляем как есть */
  }
}

/** Копирует секрет и планирует очистку буфера через {@link SECRET_CLIPBOARD_TTL_MS}. */
export async function copySecret(text: string): Promise<boolean> {
  const ok = await copyText(text)
  if (!ok) return false
  if (secretClearTimer) clearTimeout(secretClearTimer)
  secretClearTimer = setTimeout(() => void clearSecretIfStillOurs(), SECRET_CLIPBOARD_TTL_MS)
  return true
}
