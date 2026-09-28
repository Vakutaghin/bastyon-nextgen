import { describe, expect, it } from 'vitest'

import { applySpokenCommands, spokenCommandHints } from './spoken-commands'
import { joinDictation } from './join-dictation'

describe('applySpokenCommands', () => {
  it('команды, сказанные после паузы: whisper пишет их отдельными предложениями', () => {
    expect(
      applySpokenCommands('Встречаемся завтра в семь. Запятая. Не опоздывайте. Точка.', 'ru')
    ).toBe('Встречаемся завтра в семь, не опоздывайте.')
    expect(applySpokenCommands('Кто возьмет мяч? Вопросительный знак.', 'ru')).toBe(
      'Кто возьмет мяч?'
    )
    expect(applySpokenCommands('До встречи. Восклицательный знак.', 'ru')).toBe('До встречи!')
  })

  it('команды без пауз, внутри фразы', () => {
    expect(applySpokenCommands('привет запятая как дела вопросительный знак', 'ru')).toBe(
      'привет, как дела?'
    )
    expect(
      applySpokenCommands('Список дел двоеточие купить хлеб точка с запятой позвонить маме', 'ru')
    ).toBe('Список дел: купить хлеб; позвонить маме')
  })

  it('строки и абзацы, следующая строка — с большой буквы', () => {
    expect(applySpokenCommands('Привет. Новая строка. как дела', 'ru')).toBe('Привет.\nКак дела')
    expect(applySpokenCommands('Итоги встречи новый абзац решили перенести', 'ru')).toBe(
      'Итоги встречи\n\nРешили перенести'
    )
  })

  it('«точка» как обычное слово не трогается', () => {
    expect(applySpokenCommands('С моей точка зрения это верно', 'ru')).toBe(
      'С моей точка зрения это верно'
    )
    expect(applySpokenCommands('Это конечная точка', 'ru')).toBe('Это конечная точка')
    expect(applySpokenCommands('Отметь точка на карте', 'ru')).toBe('Отметь точка на карте')
  })

  it('«точка» без паузы — команда, следующее слово с большой буквы', () => {
    expect(applySpokenCommands('не опоздывайте точка кто возьмёт мяч', 'ru')).toBe(
      'не опоздывайте. Кто возьмёт мяч'
    )
    expect(applySpokenCommands('Не опоздывайте точка', 'ru')).toBe('Не опоздывайте.')
  })

  it('частая ошибка распознавания «запитая»', () => {
    expect(applySpokenCommands('Встречаемся в семь. Запитая. Не опаздывайте.', 'ru')).toBe(
      'Встречаемся в семь, не опаздывайте.'
    )
  })

  it('скобки, кавычки, тире и дефис', () => {
    expect(applySpokenCommands('Встреча открыть скобку в среду закрыть скобку утром', 'ru')).toBe(
      'Встреча (в среду) утром'
    )
    expect(applySpokenCommands('Он сказал открыть кавычки привет закрыть кавычки', 'ru')).toBe(
      'Он сказал «привет»'
    )
    expect(applySpokenCommands('Москва. Тире. столица России', 'ru')).toBe(
      'Москва — столица России'
    )
    expect(applySpokenCommands('кто дефис то', 'ru')).toBe('кто-то')
  })

  it('аббревиатуру после запятой не делает строчной', () => {
    expect(applySpokenCommands('Работаю в. Запятая. NASA', 'ru')).toBe('Работаю в, NASA')
  })

  it('английский и немецкий', () => {
    expect(
      applySpokenCommands(
        'Hello everyone comma the meeting starts at noon period can you bring the slides question mark',
        'en'
      )
    ).toBe('Hello everyone, the meeting starts at noon. Can you bring the slides?')
    expect(applySpokenCommands('It took a period of time', 'en')).toBe('It took a period of time')
    expect(applySpokenCommands('Install a dash cam', 'en')).toBe('Install a dash cam')
    expect(applySpokenCommands('Hallo Komma wie geht es Fragezeichen', 'de')).toBe(
      'Hallo, wie geht es?'
    )
  })

  it('французский: «point» внутри выражения остаётся словом', () => {
    expect(applySpokenCommands("C'est un point de vue", 'fr')).toBe("C'est un point de vue")
    expect(applySpokenCommands('Es mi punto de vista', 'es')).toBe('Es mi punto de vista')
    expect(applySpokenCommands('Llegamos a las ocho en punto', 'es')).toBe(
      'Llegamos a las ocho en punto'
    )
    expect(applySpokenCommands("Bonjour virgule ça va point d'interrogation", 'fr')).toBe(
      'Bonjour, ça va?'
    )
  })

  it('сербский латиницей и кириллицей, корейский, китайский', () => {
    expect(applySpokenCommands('Zdravo zarez kako si upitnik', 'sr')).toBe('Zdravo, kako si?')
    expect(applySpokenCommands('Здраво зарез како си упитник', 'sr')).toBe('Здраво, како си?')
    expect(applySpokenCommands('안녕하세요 쉼표 반갑습니다 마침표', 'kr')).toBe(
      '안녕하세요, 반갑습니다.'
    )
    expect(applySpokenCommands('你好逗号今天天气很好句号', 'zh')).toBe('你好，今天天气很好。')
  })

  it('неизвестный язык и пустой текст не меняются', () => {
    expect(applySpokenCommands('точка', 'xx')).toBe('точка')
    expect(applySpokenCommands('', 'ru')).toBe('')
  })

  it('подсказки команд для языка', () => {
    const hints = spokenCommandHints('ru')
    expect(hints).toContainEqual({ say: 'запятая', put: ',' })
    expect(hints).toContainEqual({ say: 'новая строка', put: '↵' })
    expect(spokenCommandHints('xx')).toEqual([])
  })
})

describe('joinDictation', () => {
  it('начало поля и начало предложения — с большой буквы', () => {
    expect(joinDictation('', '', 'привет всем.')).toBe('Привет всем.')
    expect(joinDictation('Первое.', '', 'второе.')).toBe(' Второе.')
    expect(joinDictation('Строка\n', '', 'вторая')).toBe('Вторая')
  })

  it('продолжение предложения — со строчной, имена и аббревиатуры не трогаются', () => {
    expect(joinDictation('Я вчера видел', '', 'Как он ушёл.')).toBe(' как он ушёл.')
    expect(joinDictation('Работаю в', '', 'NASA.')).toBe(' NASA.')
  })

  it('знаки препинания липнут к слову слева, после курсора — пробел', () => {
    expect(joinDictation('Привет', '', ', как дела?')).toBe(', как дела?')
    expect(joinDictation('Привет', 'мир', 'дорогой')).toBe(' дорогой ')
    expect(joinDictation('Встреча (', '', 'в среду')).toBe('в среду')
  })

  it('китайский — без пробелов', () => {
    expect(joinDictation('你好', '', '今天天气很好。', 'zh')).toBe('今天天气很好。')
  })

  it('пустая фраза — ничего', () => {
    expect(joinDictation('abc', '', '   ')).toBe('')
  })
})
