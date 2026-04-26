/**
 * Извлекает YouTube video ID из URL.
 * Поддерживает: youtube.com/watch?v=ID, youtu.be/ID
 */
const YOUTUBE_REGEX =
  /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[&\s"')\]]|$)/g

/**
 * Извлекает уникальные URL для embed iframe из текста (или JSON контента поста).
 * @param content — строка (plain text или JSON с блоками)
 * @returns массив URL вида https://www.youtube.com/embed/VIDEO_ID
 */
export function getYoutubeEmbedUrls(content: string | undefined): string[] {
  if (!content || typeof content !== 'string') return []
  const ids = new Set<string>()
  let m
  YOUTUBE_REGEX.lastIndex = 0
  while ((m = YOUTUBE_REGEX.exec(content)) !== null) {
    ids.add(m[1] ?? '')
  }
  return Array.from(ids).map((id) => `https://www.youtube.com/embed/${id}`)
}
