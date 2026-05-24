import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_ChangelogList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`

export const SC_ChangelogEntry = styled.section`
  padding: 16px 0;
  border-top: 1px solid ${COLORS.BORDER_LIGHTER};

  &:first-child {
    border-top: none;
    padding-top: 0;
  }
`

export const SC_VersionLabel = styled.div`
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: ${COLORS.PRIMARY};
  background: ${COLORS.PRIMARY_LIGHT};
  border-radius: 999px;
  padding: 3px 10px;
  margin-bottom: 12px;
`

/**
 * Контейнер для отрендеренного markdown. Селекторы тут стилизуют H1..H3,
 * списки, ссылки и прочее — стили scoped через :deep, чтобы пробить
 * inline-html, который мы кладём через v-html.
 */
export const SC_MarkdownBody = styled.div`
  color: ${COLORS.TEXT_PRIMARY};
  font-size: 14px;
  line-height: 1.55;

  :deep(h1) {
    font-size: 20px;
    font-weight: 700;
    margin: 0 0 12px;
    color: ${COLORS.TEXT_PRIMARY};
  }

  :deep(h2) {
    font-size: 16px;
    font-weight: 600;
    margin: 18px 0 8px;
    color: ${COLORS.TEXT_PRIMARY};
  }

  :deep(h3) {
    font-size: 14px;
    font-weight: 600;
    margin: 14px 0 6px;
    color: ${COLORS.TEXT_DARK};
  }

  :deep(p) {
    margin: 0 0 10px;
  }

  :deep(ul),
  :deep(ol) {
    margin: 0 0 12px;
    padding-left: 22px;
  }

  :deep(li) {
    margin: 4px 0;
  }

  :deep(a) {
    color: ${COLORS.PRIMARY};
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  :deep(code) {
    background: ${COLORS.OVERLAY_5};
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 12.5px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  :deep(strong) {
    font-weight: 600;
  }

  :deep(hr) {
    border: none;
    border-top: 1px solid ${COLORS.BORDER_LIGHTER};
    margin: 16px 0;
  }
`

export const SC_LangSwitcher = styled.div`
  display: inline-flex;
  border: 1px solid ${COLORS.BORDER};
  border-radius: 8px;
  overflow: hidden;
`

export const SC_LangButton = styled.button<{ active: boolean }>`
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  background: ${(p) => (p.active ? COLORS.PRIMARY : 'transparent')};
  color: ${(p) => (p.active ? COLORS.WHITE : COLORS.TEXT_SECONDARY)};
  border: none;
  cursor: pointer;
  transition: background-color 0.15s;

  & + & {
    border-left: 1px solid ${COLORS.BORDER};
  }

  &:hover {
    background: ${(p) => (p.active ? COLORS.PRIMARY : COLORS.PRIMARY_LIGHT)};
    color: ${(p) => (p.active ? COLORS.WHITE : COLORS.PRIMARY)};
  }
`

export const SC_EntryHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
`

export const SC_Empty = styled.div`
  padding: 24px;
  text-align: center;
  color: ${COLORS.TEXT_HINT};
  font-size: 13px;
`
