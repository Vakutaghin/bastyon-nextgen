/**
 * Сколько можно править свой пост или комментарий.
 *
 * Сеть отсчитывает 43 200 блоков от блока публикации (pocketnet.core,
 * `ConsensusLimit_edit_post_depth` и `edit_comment_depth` с высоты 2 930 000;
 * раньше были сутки). Блок в среднем чуть короче минуты — 58 с в 09–10.2026,
 * так что это около 29 суток. Кнопку прячем на сутки раньше: правку, которую
 * нода всё равно отклонит, лучше не предлагать. Старый клиент показывал кнопку
 * 120 дней — после месяца правка там молча не проходила.
 *
 * Время — исходной публикации: у отредактированного поста нода отдаёт `time`
 * первой версии.
 */
export const EDIT_WINDOW_MS = 28 * 24 * 60 * 60 * 1000

/** `publishedAtMs` — время публикации в мс; неизвестное время не прячет кнопку. */
export function isWithinEditWindow(publishedAtMs: number, now: number = Date.now()): boolean {
  if (!Number.isFinite(publishedAtMs) || publishedAtMs <= 0) return true
  return now - publishedAtMs <= EDIT_WINDOW_MS
}
