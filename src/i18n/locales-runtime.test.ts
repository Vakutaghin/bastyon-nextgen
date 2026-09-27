import { afterEach, describe, expect, it } from 'vitest'

import { bcp47, i18n, loadLocaleMessages, setI18nLocale, t, tn } from './index'

afterEach(() => setI18nLocale('ru'))

describe('языки оригинального Bastyon', () => {
  it('словарь грузится по требованию и сразу работает', async () => {
    await loadLocaleMessages('de')
    setI18nLocale('de')
    expect(t('routes.settings')).toBe('Einstellungen')
    expect(document.documentElement.lang).toBe('de')
  })

  it('сербский склоняется как русский: 1, 2–4, 5+', async () => {
    await loadLocaleMessages('sr')
    setI18nLocale('sr')
    expect(tn('commentsMsg.charsLeft', 1)).toBe('Остао је 1 знак')
    expect(tn('commentsMsg.charsLeft', 3)).toBe('Остала су 3 знака')
    expect(tn('commentsMsg.charsLeft', 11)).toBe('Остало је 11 знакова')
  })

  it('в корейском и китайском одна форма на любое число', async () => {
    await loadLocaleMessages('kr')
    setI18nLocale('kr')
    expect(tn('search.postsCount', 1)).toBe('게시물 1개')
    expect(tn('search.postsCount', 5)).toBe('게시물 5개')
  })

  it('корейский для ноды — kr, для браузера и дат — ko', async () => {
    await loadLocaleMessages('kr')
    setI18nLocale('kr')
    expect(i18n.global.locale.value).toBe('kr')
    expect(document.documentElement.lang).toBe('ko')
    expect(bcp47('kr')).toBe('ko')
    expect(bcp47('zh')).toBe('zh')
  })
})
