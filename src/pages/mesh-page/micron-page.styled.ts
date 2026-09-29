import styled from 'vue3-styled-components'

// Страница NomadNet — как в самом NomadNet: светлый моноширинный текст на
// тёмном фоне. Авторы страниц подбирают цвета под такой фон, поэтому он не
// следует теме приложения. Цвета из разметки приходят только как `#rrggbb`
// (src/mesh/reticulum/micron.ts). Константы — функциями: строка в шаблоне
// styled не проходит проверку типов.

const PAGE_FG = '#dddddd'
const PAGE_BG = '#1c1c1c'
const LINK_FG = '#7fb8ff'
const DIVIDER_FG = '#888888'
const FIELD_BG = '#2a2a2a'
const FIELD_BORDER = '#555555'
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace"

/** Заголовки трёх уровней — палитра тёмной темы NomadNet. */
const HEADINGS: Record<number, { fg: string; bg: string }> = {
  1: { fg: '#222222', bg: '#bbbbbb' },
  2: { fg: '#111111', bg: '#999999' },
  3: { fg: '#000000', bg: '#777777' },
}

export const SC_MicronPage = styled.div`
  min-height: 120px;
  max-height: 70vh;
  padding: 12px 14px;
  overflow: auto;
  border-radius: var(--ui-radius-md);
  font-family: ${() => MONO};
  font-size: 13px;
  line-height: 1.45;
  color: ${() => PAGE_FG};
  background: ${() => PAGE_BG};
`

export const SC_MicronLine = styled('div', {
  align: String,
  depth: Number,
  heading: Number,
  literal: Boolean,
})`
  min-height: 1.45em;
  padding-left: ${(p) => Math.max(0, (p.depth ?? 0) - 1) * 2}ch;
  text-align: ${(p) => p.align || 'left'};
  white-space: ${(p) => (p.literal ? 'pre' : 'pre-wrap')};
  overflow-wrap: anywhere;
  color: ${(p) => HEADINGS[p.heading ?? 0]?.fg ?? 'inherit'};
  background: ${(p) => HEADINGS[p.heading ?? 0]?.bg ?? 'transparent'};
`

export const SC_MicronDivider = styled('div', { depth: Number })`
  margin-left: ${(p) => Math.max(0, (p.depth ?? 0) - 1) * 2}ch;
  overflow: hidden;
  white-space: nowrap;
  color: ${() => DIVIDER_FG};
`

const spanProps = {
  fg: String,
  bg: String,
  bold: Boolean,
  italic: Boolean,
  underline: Boolean,
}

export const SC_MicronSpan = styled('span', spanProps)`
  color: ${(p) => p.fg || 'inherit'};
  background: ${(p) => p.bg || 'transparent'};
  font-weight: ${(p) => (p.bold ? 700 : 'inherit')};
  font-style: ${(p) => (p.italic ? 'italic' : 'inherit')};
  text-decoration: ${(p) => (p.underline ? 'underline' : 'none')};
`

export const SC_MicronLink = styled('button', spanProps)`
  display: inline;
  padding: 0;
  border: none;
  font: inherit;
  font-weight: ${(p) => (p.bold ? 700 : 'inherit')};
  font-style: ${(p) => (p.italic ? 'italic' : 'inherit')};
  text-align: inherit;
  text-decoration: underline;
  color: ${(p) => p.fg || LINK_FG};
  background: ${(p) => p.bg || 'transparent'};
  cursor: pointer;

  &:hover {
    filter: brightness(1.25);
  }

  &:focus-visible {
    outline: 1px solid ${() => LINK_FG};
    outline-offset: 1px;
  }
`

export const SC_MicronInput = styled('input', { chars: Number })`
  width: ${(p) => Math.min(p.chars || 24, 60)}ch;
  max-width: 100%;
  padding: 0 4px;
  border: 1px solid ${() => FIELD_BORDER};
  border-radius: var(--ui-radius-xs);
  font: inherit;
  color: ${() => PAGE_FG};
  background: ${() => FIELD_BG};

  &:focus {
    outline: 1px solid ${() => LINK_FG};
  }
`

export const SC_MicronCheck = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
`
