import styled from 'vue3-styled-components'
import { BREAKPOINTS, TRANSITIONS, Z_INDEX } from '@/styles/design-tokens'

// Брейкпоинт — функцией: строка в шаблоне styled не проходит проверку типов.

/** Цвет врезки GitHub: note, tip, important, warning, caution. */
function alertTone(kind: string): { rgb: string; text: string } {
  if (kind === 'tip') return { rgb: '--ui-success-rgb', text: '--ui-success' }
  if (kind === 'important') return { rgb: '--ui-violet-rgb', text: '--ui-violet' }
  if (kind === 'warning') return { rgb: '--ui-warning-rgb', text: '--ui-warning-text' }
  if (kind === 'caution') return { rgb: '--ui-error-rgb', text: '--ui-error' }
  return { rgb: '--ui-info-rgb', text: '--ui-info' }
}

export const SC_Article = styled.article`
  min-width: 0;
  color: var(--ui-text);
`

export const SC_Crumbs = styled.nav`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  margin-bottom: 10px;
  font-size: 13px;
  color: var(--ui-text-muted);

  a {
    color: var(--ui-text-muted);
    text-decoration: none;
  }

  a:hover {
    color: var(--ui-text-highlighted);
  }
`

export const SC_CrumbSep = styled.span`
  color: var(--ui-text-dimmed);
`

export const SC_Title = styled.h1`
  margin: 0 0 12px;
  font-size: 28px;
  font-weight: 650;
  line-height: 1.25;
  letter-spacing: -0.4px;
  color: var(--ui-text-highlighted);

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    font-size: 24px;
  }
`

export const SC_Compact = styled.div`
  /* В боковой панели заголовок статьи мельче: панель узкая. */
  h1 {
    font-size: 22px;
  }
`

export const SC_Platforms = styled.p`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 16px;
  padding: 3px 10px;
  border-radius: var(--ui-radius-full);
  font-size: 13px;
  color: var(--ui-text-toned);
  background: var(--ui-bg-muted);
`

export const SC_Fallback = styled.p`
  margin: 0 0 16px;
  padding: 8px 12px;
  border-radius: var(--ui-radius-md);
  font-size: 13px;
  color: var(--ui-text-muted);
  background: var(--ui-bg-muted);
`

export const SC_Body = styled.div`
  font-size: 15px;
  line-height: 1.65;

  /* Вводный абзац статьи — крупнее: по нему видно, о чём она. */
  & > p:first-child {
    font-size: 17px;
    color: var(--ui-text-toned);
  }

  p {
    margin: 0 0 12px;
  }

  h2,
  h3,
  h4 {
    color: var(--ui-text-highlighted);
    line-height: 1.3;
    scroll-margin-top: calc(var(--header-height-total, 64px) + 16px);
  }

  h2 {
    margin: 28px 0 10px;
    font-size: 20px;
    font-weight: 600;
  }

  h3 {
    margin: 22px 0 8px;
    font-size: 17px;
    font-weight: 600;
  }

  h4 {
    margin: 18px 0 6px;
    font-size: 15px;
    font-weight: 600;
  }

  ul,
  ol {
    margin: 0 0 12px;
    padding-left: 22px;
  }

  li {
    margin: 4px 0;
  }

  li > p {
    margin: 0 0 6px;
  }

  a {
    color: var(--ui-primary);
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  code {
    padding: 1px 5px;
    border-radius: var(--ui-radius-sm);
    font-family: var(--font-family-mono);
    font-size: 0.88em;
    background: var(--ui-bg-muted);
  }

  pre {
    margin: 0 0 12px;
    padding: 12px 14px;
    overflow-x: auto;
    border-radius: var(--ui-radius-md);
    background: var(--ui-bg-muted);
  }

  pre code {
    padding: 0;
    background: none;
  }

  blockquote {
    margin: 0 0 12px;
    padding: 2px 14px;
    border-left: 3px solid var(--ui-border-accented);
    color: var(--ui-text-muted);
  }

  hr {
    margin: 24px 0;
    border: none;
    border-top: 1px solid var(--ui-border);
  }

  img {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 8px 0;
    border-radius: var(--ui-radius-md);
  }

  mark {
    padding: 0 1px;
    border-radius: var(--ui-radius-xs);
    color: inherit;
    background: rgb(var(--ui-warning-rgb) / 30%);
  }

  details {
    margin: 0 0 12px;
    padding: 10px 14px;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-lg);
    background: var(--ui-bg-elevated);
  }

  summary {
    cursor: pointer;
    font-weight: 500;
    color: var(--ui-text-highlighted);
  }

  details[open] > summary {
    margin-bottom: 8px;
  }
`

export const SC_TableWrap = styled.div`
  margin: 0 0 14px;
  overflow-x: auto;

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  th,
  td {
    padding: 8px 10px;
    border: 1px solid var(--ui-border);
    text-align: left;
    vertical-align: top;
  }

  th {
    font-weight: 600;
    color: var(--ui-text-highlighted);
    background: var(--ui-bg-muted);
  }

  .align-center {
    text-align: center;
  }

  .align-right {
    text-align: right;
  }
`

export const SC_Alert = styled('div', { kind: String })`
  margin: 0 0 12px;
  padding: 10px 14px;
  border-left: 3px solid rgb(var(${(p) => alertTone(p.kind ?? '').rgb}));
  border-radius: var(--ui-radius-md);
  background: rgb(var(${(p) => alertTone(p.kind ?? '').rgb}) / 8%);

  & > p:last-child {
    margin-bottom: 0;
  }
`

export const SC_AlertTitle = styled('div', { kind: String })`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(${(p) => alertTone(p.kind ?? '').text});
`

export const SC_Term = styled.button`
  padding: 0;
  border: none;
  border-bottom: 1px dotted currentColor;
  font: inherit;
  color: inherit;
  background: none;
  cursor: help;

  &:hover,
  &:focus-visible {
    color: var(--ui-primary);
  }
`

export const SC_TermCard = styled.div`
  max-width: 320px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ui-text);

  p {
    margin: 0 0 8px;
  }

  a {
    color: var(--ui-primary);
    text-decoration: none;
  }
`

export const SC_TermTitle = styled.div`
  margin-bottom: 4px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_TermMore = styled.a`
  font-size: 13px;
  color: var(--ui-primary);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`

/** Всплывающее определение термина — над боковой панелью справки. */
export const TERM_OVERLAY_STYLE = { zIndex: Z_INDEX.HELP_PANEL + 10 }

export const SC_Sequence = styled.nav`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 36px;
  padding-top: 16px;
  border-top: 1px solid var(--ui-border);

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    grid-template-columns: 1fr;
  }
`

export const SC_SequenceLink = styled.a`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 14px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  text-decoration: none;
  transition: border-color ${() => TRANSITIONS.FAST};

  &:hover {
    border-color: var(--ui-primary);
  }

  &.next {
    grid-column: 2;
    text-align: right;
  }

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    &.next {
      grid-column: 1;
    }
  }
`

export const SC_SequenceHint = styled.span`
  font-size: 12px;
  color: var(--ui-text-muted);
`

export const SC_SequenceTitle = styled.span`
  font-size: 15px;
  font-weight: 500;
  color: var(--ui-text-highlighted);
`

export const SC_ContextLink = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: none;
  font: inherit;
  color: var(--ui-primary);
  background: none;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  &.icon-only {
    color: var(--ui-text-muted);
  }

  &.icon-only:hover {
    color: var(--ui-primary);
    text-decoration: none;
  }
`

export const SC_PanelHead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

export const SC_PanelSpacer = styled.span`
  flex: 1;
`

export const SC_PanelButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: none;
  border-radius: var(--ui-radius-md);
  font: inherit;
  font-size: 14px;
  color: var(--ui-text-toned);
  background: none;
  cursor: pointer;

  &:hover {
    color: var(--ui-text-highlighted);
    background: var(--ui-bg-muted);
  }
`

export const SC_State = styled.div`
  padding: 32px 8px;
  text-align: center;
  font-size: 14px;
  color: var(--ui-text-muted);
`

/** Стили самой панели antd: отступы тела и шапки. */
export const PANEL_BODY_STYLE = { padding: '20px 24px 32px' }
export const PANEL_HEADER_STYLE = { padding: '10px 16px' }
/**
 * Слой панели — на корне `.ant-drawer`: проп `z-index` antdv 4 кладёт на
 * внутреннюю обёртку, а корень остаётся на 1000 из CSS, и панель уходила под
 * любое окно (F1 или «?» в окне чаевых, продвижения).
 */
export const PANEL_ROOT_STYLE = { zIndex: Z_INDEX.HELP_PANEL }
