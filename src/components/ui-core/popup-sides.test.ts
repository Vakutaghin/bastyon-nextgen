// Сторож: панель, которая всегда раскрывается в одну сторону, у края экрана не
// видна. Выпадающее ставят Dropdown / Popover / Select (floating.ts) или
// v-anchored — сторону в стилях не пишут.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')

/** `top: 100%`, `bottom: calc(100% + …)` — раскрыться под или над родителем. */
const FIXED_SIDE = /^\s*(top|bottom|left|right):\s*(100%|calc\(100% \+[^;]*\));/

/**
 * Не выпадающее: подсказка над кнопкой записи и её замок, стрелка ответа при
 * смахивании, подсказки внутри плеера (он их и обрезает, стороны — по месту).
 * Реакции в чате до расчёта своего места (use-reaction-picker) ждут за экраном.
 */
const ALLOWED: Record<string, number> = {
  'b-components/messenger/components/chat-room/styled.ts': 2,
  'b-components/messenger/components/message-item/styled.ts': 2,
  'b-components/content/video-player/styled/video-controls-bar.ts': 1,
  'b-components/content/video-player/styled/video-progress.ts': 2,
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.(ts|vue|css)$/.test(name) && !name.endsWith('.test.ts') ? [path] : []
  })
}

describe('стороны выпадающих панелей', () => {
  it('новых панелей с постоянной стороной нет', () => {
    const found: Record<string, number> = {}
    for (const path of files(SRC)) {
      const count = readFileSync(path, 'utf8')
        .split('\n')
        .filter((line) => FIXED_SIDE.test(line)).length
      if (count)
        found[
          path
            .slice(SRC.length + 1)
            .split(sep)
            .join('/')
        ] = count
    }
    expect(found).toEqual(ALLOWED)
  })
})
