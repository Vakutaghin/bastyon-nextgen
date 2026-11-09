import { describe, expect, it } from 'vitest'

import { joinDictation } from './join-dictation'
import { stripModelPunctuation, voicePrompt } from './model-punctuation'
import { applySpokenCommands } from './spoken-commands'

describe('знаки модели в режиме «ставлю сам»', () => {
  it('убирает знаки, которые модель поставила сама', () => {
    expect(stripModelPunctuation('Привет, как дела?')).toBe('Привет как дела')
    expect(stripModelPunctuation('Ну… «да» — наверное!')).toBe('Ну да наверное')
    expect(stripModelPunctuation('你好，世界。')).toBe('你好 世界')
    expect(stripModelPunctuation('  ')).toBe('')
  })

  it('большая буква после её точки — строчная, имена посреди фразы — как есть', () => {
    expect(stripModelPunctuation('Я пришёл. Потом поел.')).toBe('Я пришёл потом поел')
    expect(stripModelPunctuation('Позвони Ивану в Москву')).toBe('Позвони Ивану в Москву')
    // Аббревиатура после точки не трогается.
    expect(stripModelPunctuation('Готово. NASA ответило')).toBe('Готово NASA ответило')
  })

  it('числа, время и дефис в словах остаются, тире с пробелами — нет', () => {
    expect(stripModelPunctuation('В 7:30 будет 3.5 или 1,5 литра.')).toBe(
      'В 7:30 будет 3.5 или 1,5 литра'
    )
    // Разделители подряд: версия, дата.
    expect(stripModelPunctuation('Версия 1.2.3 от 09.11.2026.')).toBe('Версия 1.2.3 от 09.11.2026')
    expect(stripModelPunctuation('Кто-то из-за угла - вот')).toBe('Кто-то из-за угла вот')
  })

  it('подсказка модели: без знаков и без больших букв в начале предложений', () => {
    expect(voicePrompt('Привет, Анна. Как дела?\nХорошо')).toBe('привет Анна как дела хорошо')
    expect(voicePrompt('')).toBe('')
  })
})

describe('«ставлю сам» целиком: ответы движка small с запретом знаков (09.11.2026)', () => {
  // Как стор и поле обрабатывают фразу: чистка, команды, склейка с текстом в поле.
  function dictate(field: string, raw: string): string {
    const chunk = applySpokenCommands(stripModelPunctuation(raw), 'ru')
    return field + joinDictation(field, '', chunk, 'ru')
  }

  it('пауза знака не ставит, имена — с большой буквы', () => {
    let field = dictate('', 'Привет как у тебя дела')
    field = dictate(field, 'Я встретил Ивана в Москве и мы договорились увидеться вечером')
    expect(field).toBe(
      'Привет как у тебя дела я встретил Ивана в Москве и мы договорились увидеться вечером'
    )
  })

  it('знаки — только сказанные', () => {
    expect(
      dictate('', 'Привет запитая как дела в опросительный знак я сегодня был в Москве точка')
    ).toBe('Привет, как дела? Я сегодня был в Москве.')
    // Точку после времени модель поставила сама — её нет, «7.30» остаётся.
    expect(
      dictate('', 'Купи хлеб запитая молоко и сыр восклицательных знак встретимся в 7.30.')
    ).toBe('Купи хлеб, молоко и сыр! Встретимся в 7.30')
  })
})
