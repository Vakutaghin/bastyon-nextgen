/**
 * Склейка продиктованной фразы с текстом вокруг курсора: пробел между
 * словами, большая буква в начале предложения и строчная — в его середине.
 *
 * Whisper начинает каждую фразу с большой буквы, будто это новое
 * предложение. Если человек сделал паузу посреди мысли, продолжение «Как он
 * ушёл» после «Я вчера видел» должно стать «как он ушёл».
 */

const SENTENCE_END = /[.!?…。！？]$/
const OPENERS = /[\s(«“„[]$/
const ATTACHES_LEFT = /^[.,;:!?…»”)\]。，；：！？]/
const WORD_START = /^[\p{L}\p{N}]/u

/** Языки без пробелов между словами. */
const NO_SPACES = new Set(['zh'])

export function joinDictation(before: string, after: string, chunk: string, lang = ''): string {
  let text = chunk.replace(/^[ \t]+|[ \t]+$/g, '')
  if (!text) return ''
  const spaced = !NO_SPACES.has(lang)
  const prev = before.replace(/[ \t]+$/, '')
  const sentenceStart = prev === '' || prev.endsWith('\n') || SENTENCE_END.test(prev)

  const m = /^(\p{L})(\p{L}*)/u.exec(text)
  if (m) {
    const [whole, first, rest] = m
    if (sentenceStart) {
      text = first!.toUpperCase() + text.slice(1)
    } else if (rest === rest!.toLowerCase() && whole.length > 0) {
      // Большая буква — от начала фразы у модели, а не имя или аббревиатура.
      text = first!.toLowerCase() + text.slice(1)
    }
  }

  if (spaced && before && !OPENERS.test(before) && !ATTACHES_LEFT.test(text)) {
    text = ' ' + text
  }
  if (spaced && after && WORD_START.test(after) && !/[\s(«“„]$/.test(text)) {
    text += ' '
  }
  return text
}
