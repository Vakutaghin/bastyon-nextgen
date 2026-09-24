/**
 * V26: в бандле Tauri действовали ДВЕ CSP — meta из index.html и заголовок из
 * `tauri.conf.json`. Браузер выполняет обе, и их пересечение запрещало то, что
 * разрешала каждая по отдельности. Здесь проверяем, что meta из html уходит и
 * что оставшаяся политика покрывает нужные директивы.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
// Плагин сборки лежит в корне репозитория рядом с vite.config.js.
import { stripMetaCsp } from '../../vite-plugin-csp.js'

const ROOT = resolve(__dirname, '../..')
const indexHtml = readFileSync(resolve(ROOT, 'index.html'), 'utf8')
const tauriCsp: string = JSON.parse(
  readFileSync(resolve(ROOT, 'src-tauri/tauri.conf.json'), 'utf8')
).app.security.csp

function directive(csp: string, name: string): string {
  const found = csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.split(/\s+/)[0] === name)
  return found ?? ''
}

describe('stripMetaCsp', () => {
  it('убирает meta-CSP из index.html', () => {
    expect(indexHtml).toContain('http-equiv="Content-Security-Policy"')
    expect(stripMetaCsp(indexHtml)).not.toContain('Content-Security-Policy')
  })

  it('не трогает остальную разметку', () => {
    const stripped = stripMetaCsp(indexHtml)
    expect(stripped).toContain('<div id="app">')
    expect(stripped).toContain('manifest.webmanifest')
  })

  it('идемпотентна — html без meta остаётся прежним', () => {
    const once = stripMetaCsp(indexHtml)
    expect(stripMetaCsp(once)).toBe(once)
  })
})

describe('CSP Tauri покрывает то, что раньше давала meta', () => {
  it('iframe мини-апп с произвольных https-хостов', () => {
    expect(directive(tauriCsp, 'frame-src')).toContain('https:')
  })

  it('локальный IPFS-шлюз остаётся разрешённым', () => {
    expect(directive(tauriCsp, 'frame-src')).toContain('http://127.0.0.1:*')
  })

  it.each(['font-src', 'worker-src', 'object-src', 'base-uri', 'form-action'])(
    'директива %s не потерялась',
    (name) => {
      expect(directive(tauriCsp, name)).not.toBe('')
    }
  )
})
