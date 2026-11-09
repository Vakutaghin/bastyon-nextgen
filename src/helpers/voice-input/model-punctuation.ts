/**
 * Кто ставит знаки препинания в голосовом вводе (настройка, по умолчанию —
 * человек).
 *
 * «Ставлю сам» (`voice`): модель пишет только слова — знаки ей запрещены в
 * движке (src-tauri/src/asr/engine.rs, `forbid_punctuation`), а точки, запятые
 * и вопросы ставят голосовые команды (spoken-commands). Пауза знака не
 * ставит, большая буква — только в начале предложения (join-dictation).
 * Раньше модель ставила знаки по паузам и интонации, а команды убирали её
 * знаки рядом с собой — два источника, и что выйдет, было не угадать.
 *
 * «Расставляет модель» (`model`): как было — знаки по паузам, команды тоже работают.
 */

export type VoicePunctuation = 'voice' | 'model'

export const DEFAULT_VOICE_PUNCTUATION: VoicePunctuation = 'voice'

/** Знаки, которые модель ставит сама, — тот же набор, что в engine.rs. */
const MARKS = /[.,!?;:…—–«»“”„"¿¡。，！？；：、]/g
/** После такого знака модель начинает слово с большой буквы. */
const SENTENCE_START = /([.!?…。！？][\s«»“”„"]*)(\p{Lu})(?=\p{Ll}*(?:[^\p{L}]|$))/gu

/**
 * Разделители внутри чисел (3.5, 1,5, 7:30) на время чистки — символами
 * частного использования. Цифра слева — в группе, а не lookbehind: его нет в
 * Safari до 16.4 и Chromium 89 (проверка бандла в сборке).
 */
const NUMBER_SEPARATOR = /(\d)([.,:])(?=\d)/g
const PROTECT: Record<string, string> = { '.': '', ',': '', ':': '' }
const RESTORE: Record<string, string> = { '': '.', '': ',', '': ':' }
const PROTECTED = /[-]/g

/**
 * Текст фразы без знаков модели — запасная чистка, если знак всё же
 * проскочил (кусок многобайтного символа, движок без запрета). Числа «3.5» и
 * «7:30» и дефис в словах («кто-то») остаются. Большая буква, которую модель
 * поставила после своей точки, — строчная: предложение там не кончалось.
 */
export function stripModelPunctuation(text: string): string {
  return text
    .replace(NUMBER_SEPARATOR, (_, digit: string, s: string) => digit + (PROTECT[s] ?? s))
    .replace(SENTENCE_START, (_, mark: string, letter: string) => mark + letter.toLowerCase())
    .replace(/(^|\s)-+(?=\s|$)/g, '$1')
    .replace(MARKS, ' ')
    .replace(PROTECTED, (s) => RESTORE[s] ?? s)
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Текст перед курсором как подсказка модели в режиме «ставлю сам»: без
 * знаков и без большой буквы в начале предложений. Модель держит стиль
 * подсказки — с точками и заглавными она тянулась бы ставить их сама.
 * Имена в середине предложения остаются с большой буквы.
 */
export function voicePrompt(context: string): string {
  const lowered = context.replace(
    /(^|\n)([\s«»“”„"]*)(\p{Lu})(?=\p{Ll}*(?:[^\p{L}]|$))/gu,
    (_, lead: string, gap: string, letter: string) => lead + gap + letter.toLowerCase()
  )
  return stripModelPunctuation(lowered)
}
