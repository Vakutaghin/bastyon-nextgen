/**
 * Тема antd держит копию палитры (antd считает оттенки из настоящих цветов,
 * var(--ui-*) ему не передать). Здесь проверяем, что копия совпадает с
 * семантическими токенами src/style.css в обеих темах.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildAntdTheme, UI_THEME_COLORS, type UiThemeColors } from './antd-theme'

const css = readFileSync(resolve(__dirname, '../style.css'), 'utf8')

function declarations(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  const end = css.indexOf('\n}\n', start)
  const body = css.slice(start + selector.length + 2, end).replace(/\/\*[\s\S]*?\*\//g, '')
  const out: Record<string, string> = {}
  for (const [, name = '', value = ''] of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out[name] = value.replace(/\s+/g, ' ').trim()
  }
  return out
}

const rootDecls = declarations(':root')
const darkDecls = { ...rootDecls, ...declarations(":root[data-theme='dark']") }

function resolveVar(decls: Record<string, string>, name: string): string {
  const value = decls[name]
  if (value === undefined) throw new Error(`нет ${name} в style.css`)
  return value.replace(/var\((--[a-z0-9-]+)\)/g, (_, ref: string) => resolveVar(decls, ref))
}

const CSS_NAMES: Record<keyof UiThemeColors, string> = {
  primary: '--ui-primary',
  primaryStrong: '--ui-primary-strong',
  primaryText: '--ui-primary-text',
  success: '--ui-success',
  info: '--ui-info',
  warning: '--ui-warning',
  error: '--ui-error',
  text: '--ui-text',
  textMuted: '--ui-text-muted',
  textDimmed: '--ui-text-dimmed',
  textHighlighted: '--ui-text-highlighted',
  textInverted: '--ui-text-inverted',
  bg: '--ui-bg',
  bgMuted: '--ui-bg-muted',
  bgElevated: '--ui-bg-elevated',
  bgAccented: '--ui-bg-accented',
  border: '--ui-border',
  borderAccented: '--ui-border-accented',
  bgElevatedRgb: '--ui-bg-elevated-rgb',
  primaryRgb: '--ui-primary-rgb',
}

describe('antd theme', () => {
  it.each([
    ['light', rootDecls],
    ['dark', darkDecls],
  ] as const)('%s: цвета совпадают с токенами style.css', (mode, decls) => {
    for (const [key, cssName] of Object.entries(CSS_NAMES)) {
      const expected = resolveVar(decls, cssName).replace(/ /g, ', ')
      expect(UI_THEME_COLORS[mode][key as keyof UiThemeColors], cssName).toBe(expected)
    }
  })

  it('алгоритм и акцент следуют теме, «успех» зелёный в обеих', () => {
    expect(buildAntdTheme(false).token?.colorPrimary).toBe('#155dfc')
    expect(buildAntdTheme(true).token?.colorPrimary).toBe('#00dc82')
    expect(buildAntdTheme(false).token?.colorSuccess).toBe('#00c16a')
    expect(buildAntdTheme(true).token?.colorSuccess).toBe('#00dc82')
    expect(buildAntdTheme(true).algorithm).not.toBe(buildAntdTheme(false).algorithm)
  })
})
