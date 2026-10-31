import { describe, expect, it } from 'vitest'
import { loadAntdLocale, serbianToCyrillic } from './antd-locale'

describe('словарь antd', () => {
  it('сербская латиница — кириллицей, с двубуквенными љ, њ, џ', () => {
    expect(serbianToCyrillic('U redu')).toBe('У реду')
    expect(serbianToCyrillic('Otkaži')).toBe('Откажи')
    expect(serbianToCyrillic('Nema podataka')).toBe('Нема података')
    expect(serbianToCyrillic('Ljubav, Njegoš, džep, Đak, ćao')).toBe('Љубав, Његош, џеп, Ђак, ћао')
  })

  it('подстановки antd остаются как есть', () => {
    expect(serbianToCyrillic('Unesi ${label}')).toBe('Унеси ${label}')
  })

  it('у каждого языка свои кнопки окна, сербский — кириллицей, форматы дат не тронуты', async () => {
    const ok = async (l: Parameters<typeof loadAntdLocale>[0]) =>
      (await loadAntdLocale(l)).Modal?.okText
    expect(await ok('ru')).toBe('OK')
    expect(await ok('kr')).toBe('확인')
    expect(await ok('zh')).toBe('确定')
    expect(await ok('sr')).toBe('У реду')
    const sr = await loadAntdLocale('sr')
    expect(sr.locale).toBe('sr')
    expect(sr.Empty?.description).toBe('Нема података')
    const picker = sr.DatePicker as { lang: { dateFormat: string; locale: string } }
    expect(picker.lang.dateFormat).toBe('DD.MM.YYYY')
    expect(picker.lang.locale).toBe('sr_RS')
  })
})
