// Сторож: техническое сообщение ошибки (английское) на экран не показывают —
// только userErrorText или коды, которым место нашло свой перевод.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')

/** Тост, окно или поле ошибки, которым отдают `e.message` или `String(e)`. */
const RAW =
  /(?:message|description|content|title):\s*(?:\(?\w+ as Error\)?\.message|\w+ instanceof Error \? \w+\.message|String\((?:e|err|error)\))|(?:error|errorText|errorMessage|submitError)\.value = (?:\(?\w+ as Error\)?\.message|\w+ instanceof Error \? \w+\.message)/

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.(ts|vue)$/.test(name) && !name.endsWith('.test.ts') ? [path] : []
  })
}

describe('тексты ошибок', () => {
  it('сообщение ошибки не попадает на экран без перевода', () => {
    const found = files(SRC)
      // Ответы мини-приложениям и события сокета — не экран.
      .filter((path) => !path.includes(`${sep}mini-apps${sep}core${sep}`))
      .filter((path) => !path.includes(`${sep}helpers${sep}api${sep}`))
      .flatMap((path) =>
        readFileSync(path, 'utf8')
          .split('\n')
          .filter((line) => RAW.test(line))
          .map((line) => `${path.slice(SRC.length + 1)}: ${line.trim()}`)
      )
    expect(found).toEqual([])
  })
})
