/**
 * Голосовые команды пунктуации: «точка», «запятая», «вопросительный знак»,
 * «новая строка»… → знаки в тексте.
 *
 * Whisper сам расставляет пунктуацию в естественной речи, но команду, сказанную
 * после паузы, пишет словом и отдельным предложением: «…в семь. Запятая. Не
 * опоздывайте. Точка.». Поэтому вместе с командой снимается пунктуация, которую
 * модель поставила вокруг неё, а регистр следующего слова возвращается к тому,
 * каким он был бы без её лишней точки.
 *
 * У многозначных слов («точка зрения», «конечная точка», «a period of time»,
 * «punto de vista») есть списки соседних слов, при которых это не команда.
 */

type Kind =
  /** Конец предложения: . ? ! … — следующее слово с большой буквы. */
  | 'end'
  /** Знак внутри предложения: , ; : */
  | 'mid'
  /** Тире с пробелами вокруг. */
  | 'dash'
  /** Дефис без пробелов. */
  | 'hyphen'
  | 'newline'
  | 'paragraph'
  /** Открывающая скобка или кавычка. */
  | 'open'
  /** Закрывающая скобка или кавычка. */
  | 'close'

interface Command {
  /** Фраза-команда: слова через пробел, варианты через |. */
  say: string
  put: string
  kind: Kind
  /**
   * Слово бывает и обычным словом. `after` — слова перед ним, `before` —
   * слова после него, при которых это не команда: «конечная точка»,
   * «точка зрения». После паузы (модель поставила знак) — всегда команда.
   */
  not?: { after?: string[]; before?: string[] }
}

const RU: Command[] = [
  { say: 'точка с запятой', put: ';', kind: 'mid' },
  {
    say: 'точка',
    put: '.',
    kind: 'end',
    not: {
      after: [
        'эта',
        'та',
        'эту',
        'ту',
        'одна',
        'одну',
        'моя',
        'твоя',
        'наша',
        'ваша',
        'его',
        'её',
        'конечная',
        'начальная',
        'отправная',
        'нулевая',
        'болевая',
        'торговая',
        'горячая',
        'высшая',
        'низшая',
        'крайняя',
        'опорная',
        'контрольная',
        'критическая',
        'красная',
        'синяя',
        'чёрная',
        'черная',
        'белая',
        'первая',
        'вторая',
        'последняя',
        'каждая',
        'какая',
        'любая',
        'новая',
        'та',
        'такая',
      ],
      before: [
        'зрения',
        'доступа',
        'отсчёта',
        'отсчета',
        'опоры',
        'невозврата',
        'кипения',
        'замерзания',
        'плавления',
        'росы',
        'пересечения',
        'соприкосновения',
        'входа',
        'выхода',
        'сбора',
        'продаж',
        'роста',
        'обзора',
        'зрении',
        'на',
        'в',
        'с',
        'где',
        'над',
        'под',
        'между',
        'и',
        'или',
        'a',
        'b',
        'а',
        'б',
      ],
    },
  },
  // «запитая» — так whisper иногда слышит «запятую», сказанную отдельно.
  { say: 'запятая|запитая', put: ',', kind: 'mid' },
  { say: 'вопросительный знак|знак вопроса|просительный знак', put: '?', kind: 'end' },
  { say: 'восклицательный знак|знак восклицания', put: '!', kind: 'end' },
  { say: 'многоточие', put: '…', kind: 'end' },
  { say: 'двоеточие', put: ':', kind: 'mid' },
  {
    say: 'тире',
    put: '—',
    kind: 'dash',
    not: { after: ['длинное', 'короткое', 'среднее', 'это', 'поставь', 'ставим'] },
  },
  { say: 'дефис', put: '-', kind: 'hyphen' },
  { say: 'новая строка|с новой строки|перенос строки', put: '\n', kind: 'newline' },
  { say: 'новый абзац|с нового абзаца', put: '\n\n', kind: 'paragraph' },
  { say: 'открыть скобку|открывающая скобка', put: '(', kind: 'open' },
  { say: 'закрыть скобку|закрывающая скобка', put: ')', kind: 'close' },
  { say: 'открыть кавычки|открываются кавычки', put: '«', kind: 'open' },
  { say: 'закрыть кавычки|закрываются кавычки', put: '»', kind: 'close' },
]

const EN: Command[] = [
  { say: 'full stop', put: '.', kind: 'end' },
  {
    say: 'period',
    put: '.',
    kind: 'end',
    not: {
      after: [
        'a',
        'the',
        'this',
        'that',
        'trial',
        'grace',
        'waiting',
        'cooling',
        'time',
        'long',
        'short',
        'first',
        'second',
        'third',
        'last',
        'same',
        'whole',
        'entire',
        'given',
        'any',
        'each',
        'every',
        'one',
        'holiday',
        'reporting',
        'billing',
        'notice',
        'probation',
        'transition',
        'incubation',
        'warranty',
        'study',
        'test',
        'school',
        'rest',
        'my',
        'her',
      ],
      before: ['of', 'in', 'when', 'during', 'between', 'pain', 'pains', 'cramps', 'drama'],
    },
  },
  { say: 'comma', put: ',', kind: 'mid' },
  { say: 'question mark', put: '?', kind: 'end' },
  { say: 'exclamation mark|exclamation point', put: '!', kind: 'end' },
  { say: 'ellipsis', put: '…', kind: 'end' },
  { say: 'semicolon', put: ';', kind: 'mid' },
  {
    say: 'colon',
    put: ':',
    kind: 'mid',
    not: {
      after: ['the', 'a', 'my', 'his', 'her', 'sigmoid', 'ascending', 'descending', 'transverse'],
      before: ['cancer', 'cleanse', 'surgery', 'polyps', 'health'],
    },
  },
  {
    say: 'dash',
    put: '—',
    kind: 'dash',
    not: {
      after: ['a', 'the', 'dot', 'mad', 'quick', 'little', 'em', 'en'],
      before: ['cam', 'board', 'of', 'to', 'off', 'into', 'out', 'across'],
    },
  },
  { say: 'hyphen', put: '-', kind: 'hyphen' },
  { say: 'new line|newline|next line', put: '\n', kind: 'newline' },
  { say: 'new paragraph|next paragraph', put: '\n\n', kind: 'paragraph' },
  { say: 'open parenthesis|open bracket', put: '(', kind: 'open' },
  { say: 'close parenthesis|close bracket', put: ')', kind: 'close' },
  { say: 'open quote', put: '“', kind: 'open' },
  { say: 'close quote|end quote|unquote', put: '”', kind: 'close' },
]

const DE: Command[] = [
  {
    say: 'punkt',
    put: '.',
    kind: 'end',
    not: {
      after: [
        'der',
        'den',
        'dem',
        'ein',
        'einen',
        'einem',
        'diesem',
        'dieser',
        'wichtiger',
        'springende',
        'springenden',
        'nächster',
        'letzter',
        'erster',
        'zweiter',
        'toter',
      ],
      before: ['für', 'eins', 'zwei', 'drei', 'genau', 'um', 'zu', 'auf', 'in'],
    },
  },
  { say: 'komma', put: ',', kind: 'mid' },
  { say: 'fragezeichen', put: '?', kind: 'end' },
  { say: 'ausrufezeichen', put: '!', kind: 'end' },
  { say: 'semikolon', put: ';', kind: 'mid' },
  { say: 'doppelpunkt', put: ':', kind: 'mid' },
  { say: 'gedankenstrich', put: '—', kind: 'dash' },
  { say: 'bindestrich', put: '-', kind: 'hyphen' },
  { say: 'neue zeile|zeilenumbruch', put: '\n', kind: 'newline' },
  { say: 'neuer absatz', put: '\n\n', kind: 'paragraph' },
  { say: 'klammer auf', put: '(', kind: 'open' },
  { say: 'klammer zu', put: ')', kind: 'close' },
  { say: 'anführungszeichen auf|anführungszeichen unten', put: '„', kind: 'open' },
  { say: 'anführungszeichen zu|anführungszeichen oben', put: '“', kind: 'close' },
]

const FR: Command[] = [
  { say: "point d'interrogation|point d’interrogation", put: '?', kind: 'end' },
  { say: "point d'exclamation|point d’exclamation", put: '!', kind: 'end' },
  { say: 'point-virgule|point virgule', put: ';', kind: 'mid' },
  { say: 'points de suspension', put: '…', kind: 'end' },
  {
    say: 'point',
    put: '.',
    kind: 'end',
    not: {
      after: [
        'un',
        'le',
        'ce',
        'du',
        'au',
        'mon',
        'ton',
        'son',
        'notre',
        'votre',
        'leur',
        'en',
        'bon',
        'à',
        'sur',
        'quel',
        'chaque',
        'dernier',
        'premier',
        'mauvais',
        'seul',
        'même',
      ],
      before: ['de', 'du', 'des', "d'honneur", 'fort', 'faible', 'commun', 'noir', 'mort'],
    },
  },
  { say: 'virgule', put: ',', kind: 'mid' },
  { say: 'deux-points|deux points', put: ':', kind: 'mid' },
  {
    say: 'tiret',
    put: '—',
    kind: 'dash',
    not: { after: ['un', 'le', 'ce'], before: ['du', 'de'] },
  },
  { say: 'à la ligne|nouvelle ligne|retour à la ligne', put: '\n', kind: 'newline' },
  { say: 'nouveau paragraphe', put: '\n\n', kind: 'paragraph' },
  { say: 'ouvrir la parenthèse|ouvrez la parenthèse', put: '(', kind: 'open' },
  { say: 'fermer la parenthèse|fermez la parenthèse', put: ')', kind: 'close' },
  { say: 'ouvrir les guillemets|ouvrez les guillemets', put: '«', kind: 'open' },
  { say: 'fermer les guillemets|fermez les guillemets', put: '»', kind: 'close' },
]

const ES: Command[] = [
  { say: 'punto y coma', put: ';', kind: 'mid' },
  { say: 'punto y aparte', put: '.\n', kind: 'newline' },
  { say: 'puntos suspensivos', put: '…', kind: 'end' },
  {
    say: 'punto',
    put: '.',
    kind: 'end',
    not: {
      after: [
        'un',
        'el',
        'en',
        'al',
        'del',
        'este',
        'ese',
        'aquel',
        'buen',
        'mi',
        'tu',
        'su',
        'qué',
        'cada',
      ],
      before: ['de', 'en', 'por', 'final', 'fuerte', 'débil', 'clave', 'medio', 'muerto'],
    },
  },
  { say: 'coma', put: ',', kind: 'mid' },
  { say: 'dos puntos', put: ':', kind: 'mid' },
  { say: 'signo de interrogación|signo de pregunta', put: '?', kind: 'end' },
  { say: 'signo de exclamación', put: '!', kind: 'end' },
  { say: 'nueva línea|salto de línea', put: '\n', kind: 'newline' },
  { say: 'nuevo párrafo', put: '\n\n', kind: 'paragraph' },
  { say: 'abrir paréntesis', put: '(', kind: 'open' },
  { say: 'cerrar paréntesis', put: ')', kind: 'close' },
  { say: 'abrir comillas', put: '«', kind: 'open' },
  { say: 'cerrar comillas', put: '»', kind: 'close' },
]

const IT: Command[] = [
  { say: 'punto e virgola', put: ';', kind: 'mid' },
  { say: 'punto interrogativo', put: '?', kind: 'end' },
  { say: 'punto esclamativo', put: '!', kind: 'end' },
  { say: 'puntini di sospensione', put: '…', kind: 'end' },
  {
    say: 'punto',
    put: '.',
    kind: 'end',
    not: {
      after: [
        'il',
        'un',
        'al',
        'del',
        'dal',
        'nel',
        'sul',
        'questo',
        'quel',
        'che',
        'ogni',
        'mio',
        'tuo',
        'suo',
        'buon',
        'in',
        'a',
      ],
      before: ['di', 'per', 'in', 'a', 'forte', 'debole', 'chiave', 'morto', 'vendita'],
    },
  },
  { say: 'virgola', put: ',', kind: 'mid' },
  { say: 'due punti', put: ':', kind: 'mid' },
  { say: 'a capo|nuova riga', put: '\n', kind: 'newline' },
  { say: 'nuovo paragrafo', put: '\n\n', kind: 'paragraph' },
  { say: 'apri parentesi|aperta parentesi', put: '(', kind: 'open' },
  { say: 'chiudi parentesi|chiusa parentesi', put: ')', kind: 'close' },
  { say: 'apri virgolette|aperte virgolette', put: '«', kind: 'open' },
  { say: 'chiudi virgolette|chiuse virgolette', put: '»', kind: 'close' },
]

// Сербский whisper пишет то кириллицей, то латиницей — команды в обоих видах.
const SR: Command[] = [
  { say: 'тачка зарез|tačka zarez', put: ';', kind: 'mid' },
  {
    say: 'тачка|tačka',
    put: '.',
    kind: 'end',
    not: {
      after: [
        'једна',
        'ова',
        'та',
        'главна',
        'полазна',
        'крајња',
        'jedna',
        'ova',
        'ta',
        'glavna',
        'polazna',
        'krajnja',
      ],
      before: ['гледишта', 'на', 'у', 'gledišta', 'na', 'u'],
    },
  },
  { say: 'зарез|zarez', put: ',', kind: 'mid' },
  { say: 'упитник|upitnik', put: '?', kind: 'end' },
  { say: 'узвичник|uzvičnik', put: '!', kind: 'end' },
  { say: 'две тачке|dve tačke', put: ':', kind: 'mid' },
  { say: 'нови ред|novi red', put: '\n', kind: 'newline' },
  { say: 'нови пасус|novi pasus', put: '\n\n', kind: 'paragraph' },
  { say: 'отвори заграду|otvori zagradu', put: '(', kind: 'open' },
  { say: 'затвори заграду|zatvori zagradu', put: ')', kind: 'close' },
]

const KO: Command[] = [
  { say: '마침표', put: '.', kind: 'end' },
  { say: '쉼표', put: ',', kind: 'mid' },
  { say: '물음표', put: '?', kind: 'end' },
  { say: '느낌표', put: '!', kind: 'end' },
  { say: '콜론', put: ':', kind: 'mid' },
  { say: '줄 바꿈|줄바꿈|다음 줄', put: '\n', kind: 'newline' },
  { say: '새 단락|새 문단', put: '\n\n', kind: 'paragraph' },
]

// Китайский пишется без пробелов: команды ищутся без границ слов, знаки —
// полноширинные. Whisper пишет то упрощёнными, то традиционными иероглифами.
const ZH: Command[] = [
  { say: '句号|句號', put: '。', kind: 'end' },
  { say: '逗号|逗號', put: '，', kind: 'mid' },
  { say: '问号|問號', put: '？', kind: 'end' },
  { say: '感叹号|感嘆號|叹号|嘆號', put: '！', kind: 'end' },
  { say: '冒号|冒號', put: '：', kind: 'mid' },
  { say: '分号|分號', put: '；', kind: 'mid' },
  { say: '换行|換行|新的一行', put: '\n', kind: 'newline' },
  { say: '新段落|另起一段', put: '\n\n', kind: 'paragraph' },
  { say: '左括号|左括號', put: '（', kind: 'open' },
  { say: '右括号|右括號', put: '）', kind: 'close' },
]

const COMMANDS: Record<string, Command[]> = {
  ru: RU,
  en: EN,
  de: DE,
  fr: FR,
  es: ES,
  it: IT,
  sr: SR,
  kr: KO,
  ko: KO,
  zh: ZH,
}

/** Языки, где слова разделены пробелами и команда — целое слово. */
const NO_WORD_BOUNDARIES = new Set(['zh'])

/** Пунктуация, которую модель ставит вокруг сказанной команды. */
const PUNCT = /[.,;:!?…。，；：！？]/
const PUNCT_OR_SPACE = /[\s.,;:!?…。，；：！？]/
const SENTENCE_BREAK = /[.!?…。！？]/
const WORD_CHAR = /[\p{L}\p{N}]/u

interface Compiled {
  re: RegExp
  byPhrase: Map<string, Command>
  /** Слова разделены пробелами (кроме китайского). */
  spaced: boolean
}

const compiledCache = new Map<string, Compiled | null>()

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function compile(lang: string): Compiled | null {
  if (compiledCache.has(lang)) return compiledCache.get(lang) ?? null
  const commands = COMMANDS[lang]
  if (!commands) {
    compiledCache.set(lang, null)
    return null
  }
  const byPhrase = new Map<string, Command>()
  const phrases: string[] = []
  for (const cmd of commands) {
    for (const phrase of cmd.say.split('|')) {
      byPhrase.set(phrase, cmd)
      phrases.push(phrase)
    }
  }
  // Длинные фразы раньше: «точка с запятой» прежде «точки».
  phrases.sort((a, b) => b.length - a.length)
  const alternatives = phrases.map((p) => escapeRe(p).replace(/ /g, '\\s+')).join('|')
  const result: Compiled = {
    re: new RegExp(`(?:${alternatives})`, 'giu'),
    byPhrase,
    spaced: !NO_WORD_BOUNDARIES.has(lang),
  }
  compiledCache.set(lang, result)
  return result
}

function commandFor(compiled: Compiled, matched: string): Command | undefined {
  return compiled.byPhrase.get(matched.toLowerCase().replace(/\s+/g, ' '))
}

/** Соседнее слово слева / справа от команды (без пунктуации, строчными). */
function wordBefore(text: string, index: number): string {
  const m = /([\p{L}\p{N}'’-]+)[^\p{L}\p{N}]*$/u.exec(text.slice(0, index))
  return m ? m[1]!.toLowerCase() : ''
}

function wordAfter(text: string, index: number): string {
  const m = /^[^\p{L}\p{N}]*([\p{L}\p{N}'’-]+)/u.exec(text.slice(index))
  return m ? m[1]!.toLowerCase() : ''
}

type CaseFix = 'upper' | 'lower' | null

/** Первая буква строки (после пробелов) в нужном регистре. */
function fixCase(chunk: string, fix: CaseFix): { text: string; done: boolean } {
  if (!fix) return { text: chunk, done: true }
  const m = /^(\s*)(\p{L})(\p{L}*)/u.exec(chunk)
  if (!m) return { text: chunk, done: chunk.trim().length > 0 }
  const [, lead, first, rest] = m
  if (fix === 'lower') {
    // Аббревиатуры и слова вроде «iPhone» не трогаем.
    if (rest !== rest!.toLowerCase()) return { text: chunk, done: true }
    return {
      text: lead + first!.toLowerCase() + chunk.slice(m[0].length - rest!.length),
      done: true,
    }
  }
  return { text: lead + first!.toUpperCase() + chunk.slice(m[0].length - rest!.length), done: true }
}

/**
 * Заменить сказанные команды знаками. `lang` — язык диктовки (коды интерфейса:
 * ru, en, de, fr, es, it, sr, kr, zh). Для неизвестного языка текст не меняется.
 */
export function applySpokenCommands(text: string, lang: string): string {
  const compiled = compile(lang)
  if (!compiled || !text) return text
  let out = ''
  let pos = 0
  let caseFix: CaseFix = null
  let spaceNext = false
  let trimNext = false

  const emit = (chunk: string): void => {
    let piece = chunk
    if (trimNext) piece = piece.replace(/^[ \t]+/, '')
    if (spaceNext && piece && !/^[\s.,;:!?…»”)]/.test(piece)) piece = ' ' + piece
    if (piece.length) {
      trimNext = false
      spaceNext = false
    }
    const fixed = fixCase(piece, caseFix)
    if (fixed.done) caseFix = null
    out += fixed.text
  }

  compiled.re.lastIndex = 0
  for (let m = compiled.re.exec(text); m; m = compiled.re.exec(text)) {
    const start = m.index
    const end = start + m[0].length
    if (start < pos) continue
    const cmd = commandFor(compiled, m[0])
    if (!cmd) continue
    if (compiled.spaced) {
      const before = text[start - 1]
      const after = text[end]
      if ((before && WORD_CHAR.test(before)) || (after && WORD_CHAR.test(after))) continue
    }
    // Пунктуация модели вокруг команды.
    let a = start
    while (a > pos && PUNCT_OR_SPACE.test(text[a - 1]!)) a--
    let b = end
    while (b < text.length && PUNCT.test(text[b]!)) b++
    const gapBefore = text.slice(a, start)
    const breakBefore = SENTENCE_BREAK.test(gapBefore)
    const breakAfter = SENTENCE_BREAK.test(text.slice(end, b))
    if (cmd.not && !breakBefore && !breakAfter) {
      const prev = wordBefore(text, start)
      const next = wordAfter(text, end)
      if (cmd.not.after?.includes(prev) || cmd.not.before?.includes(next)) continue
    }

    emit(text.slice(pos, a))
    // Перенос строки и открывающие знаки не отменяют знак, который модель
    // поставила перед ними: предложение перед переносом закончено.
    if (cmd.kind === 'newline' || cmd.kind === 'paragraph' || cmd.kind === 'open') {
      out += gapBefore.replace(/\s+/g, '')
    } else if (cmd.kind === 'close') {
      out += gapBefore.replace(/[^?!…]/g, '')
    }
    const space = compiled.spaced ? ' ' : ''
    switch (cmd.kind) {
      case 'end':
      case 'mid':
        out = out.replace(/[ \t]+$/, '') + cmd.put
        spaceNext = compiled.spaced
        break
      case 'dash':
        out = out.replace(/[ \t]+$/, '') + (out.trim() ? space : '') + cmd.put
        spaceNext = compiled.spaced
        break
      case 'hyphen':
        out = out.replace(/[ \t]+$/, '') + cmd.put
        trimNext = true
        break
      case 'newline':
      case 'paragraph':
        out = out.replace(/[ \t]+$/, '') + cmd.put
        trimNext = true
        break
      case 'open':
        if (out && !/[\s(«“„]$/.test(out)) out += space
        out += cmd.put
        trimNext = true
        break
      case 'close':
        out = out.replace(/[ \t]+$/, '') + cmd.put
        spaceNext = compiled.spaced
        break
    }
    if (cmd.kind === 'end' || cmd.kind === 'newline' || cmd.kind === 'paragraph') {
      caseFix = 'upper'
    } else if (breakBefore || breakAfter) {
      // Большая буква взялась из лишней точки модели — возвращаем строчную.
      caseFix = 'lower'
    } else {
      caseFix = null
    }
    pos = b
  }
  emit(text.slice(pos))
  return tidy(out)
}

/** Пробелы перед знаками, повторы вроде «. .», пробелы у переносов строк. */
function tidy(text: string): string {
  return text
    .replace(/[ \t]+([.,;:!?…»”)])/g, '$1')
    .replace(/([.,;:!?])(?:\s+\1)+/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
}

/** Команды для подсказки: что сказать → какой знак. */
export function spokenCommandHints(lang: string): { say: string; put: string }[] {
  const commands = COMMANDS[lang] ?? []
  return commands.map((c) => ({
    say: c.say.split('|')[0]!,
    put: c.put === '\n' ? '↵' : c.put === '\n\n' ? '¶' : c.put.trim(),
  }))
}
