// matrix-js-sdk пропатчен (patches/matrix-js-sdk@40.1.0.patch): правила уведомлений
// по тексту сообщения ищут слово без lookbehind — его нет в Safari до 16.4, а
// регэксп строится на каждое входящее сообщение. Поведение — как у оригинала.

import { describe, expect, it } from 'vitest'
import { PushProcessor } from 'matrix-js-sdk/lib/pushprocessor'

describe('PushProcessor.getPushRuleGlobRegex (патч под Safari 15)', () => {
  it('без lookbehind', () => {
    expect(PushProcessor.getPushRuleGlobRegex('alice', true).source).not.toMatch(/\(\?<[=!]/)
  })

  it.each([
    ['alice', true],
    ['hi alice!', true],
    ['Alice, привет', true],
    ['@alice:server', true],
    ['malice', false],
    ['alicebob', false],
  ])('«%s» — упоминание слова alice: %s', (text, expected) => {
    expect(!!text.match(PushProcessor.getPushRuleGlobRegex('alice', true))).toBe(expected)
  })

  it('группа 1 — сам шаблон, без символа перед ним; глоб * работает', () => {
    expect('привет alice!'.match(PushProcessor.getPushRuleGlobRegex('alice', true))?.[1]).toBe(
      'alice'
    )
    expect(!!'зовите bob42'.match(PushProcessor.getPushRuleGlobRegex('bob*', true))).toBe(true)
  })
})
