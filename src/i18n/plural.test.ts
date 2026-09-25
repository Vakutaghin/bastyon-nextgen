import { describe, it, expect, afterEach } from 'vitest'
import { ruPluralRule, setI18nLocale, tn } from './index'
import { getCommentLengthHint } from '@/b-components/content/post-card/components/post-card-comments/helpers'
import { COMMENT_MAX_LENGTH } from '@/b-components/content/post-card/components/post-card-comments/consts'

afterEach(() => setI18nLocale('ru'))

describe('ruPluralRule', () => {
  it('один / несколько / много — с исключениями 11–14', () => {
    const form = (n: number) => ruPluralRule(n, 3)
    expect([1, 21, 101].map(form)).toEqual([0, 0, 0])
    expect([2, 3, 4, 22, 104].map(form)).toEqual([1, 1, 1, 1, 1])
    expect([5, 11, 12, 14, 19, 100, 111].map(form)).toEqual([2, 2, 2, 2, 2, 2, 2])
  })

  it('при четырёх формах первая — для нуля', () => {
    expect(ruPluralRule(0, 4)).toBe(0)
    expect(ruPluralRule(1, 4)).toBe(1)
    expect(ruPluralRule(3, 4)).toBe(2)
    expect(ruPluralRule(7, 4)).toBe(3)
  })
})

describe('tn и счётчик символов комментария (S62)', () => {
  it('склоняет по-русски, включая 21 и 11', () => {
    setI18nLocale('ru')
    expect(tn('commentsMsg.charsLeft', 21)).toBe('Остался 21 символ')
    expect(tn('commentsMsg.charsLeft', 3)).toBe('Осталось 3 символа')
    expect(tn('commentsMsg.charsLeft', 11)).toBe('Осталось 11 символов')
  })

  it('в английском интерфейсе — английский текст', () => {
    setI18nLocale('en')
    const hint = getCommentLengthHint('x'.repeat(COMMENT_MAX_LENGTH + 2))
    expect(hint).toEqual({ text: '2 characters over the limit', isOver: true })
  })
})
