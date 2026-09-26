// Основа слова для поиска по справке: «ключей», «ключами» и «ключ» — одно и
// то же. Русский — алгоритм Snowball (snowballstem.org/algorithms/russian),
// английский — первый шаг Porter2 (множественное число, -ed, -ing): для
// поиска по справке этого хватает. Индекс и запрос проходят одну и ту же
// обработку, поэтому неточности стемминга взаимно гасятся.

const RU_VOWELS = 'аеиоуыэюя'

interface Group {
  endings: readonly string[]
  /** Окончание считается, только если перед ним «а» или «я» (они остаются). */
  afterAYa: boolean
}

const PERFECTIVE_GERUND: Group[] = [
  { endings: ['в', 'вши', 'вшись'], afterAYa: true },
  { endings: ['ив', 'ивши', 'ившись', 'ыв', 'ывши', 'ывшись'], afterAYa: false },
]
const REFLEXIVE: Group[] = [{ endings: ['ся', 'сь'], afterAYa: false }]
const ADJECTIVE: Group[] = [
  {
    endings: [
      'ее',
      'ие',
      'ые',
      'ое',
      'ими',
      'ыми',
      'ей',
      'ий',
      'ый',
      'ой',
      'ем',
      'им',
      'ым',
      'ом',
      'его',
      'ого',
      'ему',
      'ому',
      'их',
      'ых',
      'ую',
      'юю',
      'ая',
      'яя',
      'ою',
      'ею',
    ],
    afterAYa: false,
  },
]
const PARTICIPLE: Group[] = [
  { endings: ['ем', 'нн', 'вш', 'ющ', 'щ'], afterAYa: true },
  { endings: ['ивш', 'ывш', 'ующ'], afterAYa: false },
]
const VERB: Group[] = [
  {
    endings: [
      'ла',
      'на',
      'ете',
      'йте',
      'ли',
      'й',
      'л',
      'ем',
      'н',
      'ло',
      'но',
      'ет',
      'ют',
      'ны',
      'ть',
      'ешь',
      'нно',
    ],
    afterAYa: true,
  },
  {
    endings: [
      'ила',
      'ыла',
      'ена',
      'ейте',
      'уйте',
      'ите',
      'или',
      'ыли',
      'ей',
      'уй',
      'ил',
      'ыл',
      'им',
      'ым',
      'ен',
      'ило',
      'ыло',
      'ено',
      'ят',
      'ует',
      'уют',
      'ит',
      'ыт',
      'ены',
      'ить',
      'ыть',
      'ишь',
      'ую',
      'ю',
    ],
    afterAYa: false,
  },
]
const NOUN: Group[] = [
  {
    endings: [
      'а',
      'ев',
      'ов',
      'ие',
      'ье',
      'е',
      'иями',
      'ями',
      'ами',
      'еи',
      'ии',
      'и',
      'ией',
      'ей',
      'ой',
      'ий',
      'й',
      'иям',
      'ям',
      'ием',
      'ем',
      'ам',
      'ом',
      'о',
      'у',
      'ах',
      'иях',
      'ях',
      'ы',
      'ь',
      'ию',
      'ью',
      'ю',
      'ия',
      'ья',
      'я',
    ],
    afterAYa: false,
  },
]
const DERIVATIONAL: Group[] = [{ endings: ['ост', 'ость'], afterAYa: false }]

const isRuVowel = (ch: string | undefined): boolean => ch !== undefined && RU_VOWELS.includes(ch)

/** RV — после первой гласной, R2 — как в Snowball. */
function ruRegions(word: string): { rv: number; r2: number } {
  const n = word.length
  let i = 0
  while (i < n && !isRuVowel(word[i])) i++
  if (i >= n) return { rv: n, r2: n }
  const rv = i + 1
  let j = rv
  while (j < n && isRuVowel(word[j])) j++
  if (j >= n) return { rv, r2: n }
  let k = j + 1
  while (k < n && !isRuVowel(word[k])) k++
  let m = k + 1
  while (m < n && isRuVowel(word[m])) m++
  return { rv, r2: m < n ? m + 1 : n }
}

/**
 * Как `among` в Snowball: берётся самое длинное подходящее окончание в RV;
 * если его условие не выполнено, более короткие не пробуются.
 */
function cut(word: string, rv: number, groups: Group[]): string | null {
  let best: { ending: string; group: Group } | null = null
  for (const group of groups) {
    for (const ending of group.endings) {
      if (word.endsWith(ending) && word.length - ending.length >= rv) {
        if (!best || ending.length > best.ending.length) best = { ending, group }
      }
    }
  }
  if (!best) return null
  const at = word.length - best.ending.length
  if (best.group.afterAYa) {
    const prev = word[at - 1]
    if (at - 1 < rv || (prev !== 'а' && prev !== 'я')) return null
  }
  return word.slice(0, at)
}

export function stemRu(input: string): string {
  let word = input.replace(/ё/g, 'е')
  const { rv, r2 } = ruRegions(word)
  if (rv >= word.length) return word

  const gerund = cut(word, rv, PERFECTIVE_GERUND)
  if (gerund !== null) {
    word = gerund
  } else {
    word = cut(word, rv, REFLEXIVE) ?? word
    const adjective = cut(word, rv, ADJECTIVE)
    if (adjective !== null) {
      word = cut(adjective, rv, PARTICIPLE) ?? adjective
    } else {
      word = cut(word, rv, VERB) ?? cut(word, rv, NOUN) ?? word
    }
  }

  if (word.endsWith('и') && word.length - 1 >= rv) word = word.slice(0, -1)

  const derivational = cut(word, rv, DERIVATIONAL)
  if (derivational !== null && derivational.length >= r2) word = derivational

  const undouble = (w: string): string =>
    w.endsWith('нн') && w.length - 2 >= rv ? w.slice(0, -1) : w
  if (word.endsWith('ейше') && word.length - 4 >= rv) word = undouble(word.slice(0, -4))
  else if (word.endsWith('ейш') && word.length - 3 >= rv) word = undouble(word.slice(0, -3))
  else if (word.endsWith('н')) word = undouble(word)
  else if (word.endsWith('ь') && word.length - 1 >= rv) word = word.slice(0, -1)
  return word
}

const EN_VOWEL = /[aeiouy]/
const EN_DOUBLE = /(bb|dd|ff|gg|mm|nn|pp|rr|tt)$/

export function stemEn(input: string): string {
  let word = input.replace(/['’]s?$/, '')
  if (word.length <= 2) return word

  // Porter2, шаг 1a: окончания множественного числа.
  if (word.endsWith('sses')) word = word.slice(0, -2)
  else if (word.endsWith('ied') || word.endsWith('ies'))
    word = word.slice(0, word.length > 4 ? -2 : -1)
  else if (word.endsWith('s') && !word.endsWith('us') && !word.endsWith('ss')) {
    if (EN_VOWEL.test(word.slice(0, -2))) word = word.slice(0, -1)
  }

  // Шаг 1b: -eed, -ed, -ing.
  const eed = /eed(ly)?$/.exec(word)
  if (eed) {
    if (word.length - eed[0].length > 1) word = word.slice(0, word.length - eed[0].length) + 'ee'
  } else {
    const suffix = /(ed|edly|ing|ingly)$/.exec(word)
    if (suffix && EN_VOWEL.test(word.slice(0, suffix.index))) {
      word = word.slice(0, suffix.index)
      if (/(at|bl|iz)$/.test(word)) word += 'e'
      else if (EN_DOUBLE.test(word)) word = word.slice(0, -1)
    }
  }

  // Шаг 1c: -y после согласной → -i.
  if (word.length > 2 && /[^aeiou][yY]$/.test(word)) word = word.slice(0, -1) + 'i'
  return word
}

const STOP_WORDS = new Set([
  // русские
  'и',
  'в',
  'во',
  'не',
  'что',
  'он',
  'на',
  'я',
  'с',
  'со',
  'как',
  'а',
  'то',
  'все',
  'она',
  'так',
  'его',
  'но',
  'да',
  'ты',
  'к',
  'у',
  'же',
  'вы',
  'за',
  'бы',
  'по',
  'ее',
  'мне',
  'было',
  'вот',
  'от',
  'меня',
  'о',
  'из',
  'ему',
  'ли',
  'если',
  'уже',
  'или',
  'ни',
  'был',
  'до',
  'вас',
  'там',
  'они',
  'где',
  'есть',
  'для',
  'мы',
  'их',
  'чем',
  'была',
  'без',
  'под',
  'будет',
  'кто',
  'этот',
  'того',
  'это',
  'эти',
  'этой',
  'этого',
  'при',
  'об',
  'над',
  'про',
  'через',
  'нас',
  'вам',
  'ваш',
  'ваши',
  // английские
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'is',
  'it',
  'for',
  'on',
  'with',
  'as',
  'be',
  'by',
  'at',
  'that',
  'this',
  'are',
  'was',
  'from',
  'but',
  'not',
  'if',
  'so',
  'do',
  'does',
])

/** Слова текста: буквы и цифры, остальное — разделители. */
export function splitWords(text: string): string[] {
  return text.match(/[\p{L}\p{N}]+/gu) ?? []
}

/** Слово → основа для индекса и запроса; null — слово не ищем (служебное). */
export function searchTerm(word: string): string | null {
  const w = word.toLowerCase().replace(/ё/g, 'е')
  if (w.length < 2 || STOP_WORDS.has(w)) return null
  if (/[а-я]/.test(w)) return stemRu(w)
  if (/^[a-z]+$/.test(w)) return stemEn(w)
  return w
}

/** Основы слов запроса — для подсветки найденного. */
export function queryStems(query: string): string[] {
  const stems = splitWords(query)
    .map(searchTerm)
    .filter((s): s is string => !!s)
  return [...new Set(stems)]
}

/** Слово подходит под запрос: его основа начинается с основы одного из слов запроса. */
export function wordMatches(word: string, stems: readonly string[]): boolean {
  if (!stems.length) return false
  const term = searchTerm(word)
  return term !== null && stems.some((stem) => term.startsWith(stem))
}

export interface HelpMarkPart {
  text: string
  mark: boolean
}

/** Текст, разбитый на куски: найденные слова отмечены. */
export function markWords(text: string, stems: readonly string[]): HelpMarkPart[] {
  if (!stems.length) return [{ text, mark: false }]
  const parts: HelpMarkPart[] = []
  let last = 0
  for (const m of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    if (!wordMatches(m[0], stems)) continue
    const at = m.index ?? 0
    if (at > last) parts.push({ text: text.slice(last, at), mark: false })
    parts.push({ text: m[0], mark: true })
    last = at + m[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), mark: false })
  return parts
}
