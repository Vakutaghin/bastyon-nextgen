import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

// Общие примитивы эксплорера (audit §3.1).
import {
  SC_InlineLink,
  SC_Placeholder,
  SC_PlaceholderError,
} from '../components/shared/explorer-primitives.styled'

export { SC_InlineLink, SC_Placeholder, SC_PlaceholderError }

export const SC_InlineLinkBlock = styled(SC_InlineLink)`
  margin-right: 6px;
`

export const SC_TxPageWork = styled.div`
  display: flex;
  flex: 1;
  width: 100%;
  background: var(--color-bg-primary);
`

export const SC_TxPagePage = styled.main`
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  /* Отступ сверху — высота фиксированной шапки плюс 28px воздуха. */
  padding: calc(var(--header-height-total) + 28px) 24px 48px;
`

export const SC_TxBreadcrumb = styled.div`
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--color-text-muted);

  a {
    color: var(--color-link);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`

export const SC_TxTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 24px;
`

export const SC_TxTitle = styled.h1`
  font-size: 22px;
  font-weight: 700;
  color: var(--ui-text-highlighted);
  margin: 0;
`

export const SC_TxTypeBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-radius: var(--ui-radius-lg);
`

export const SC_TxMetaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  background: var(--ui-bg);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
  margin-bottom: 24px;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    grid-template-columns: 1fr;
  }
`

export const SC_TxMetaCell = styled.div`
  padding: 14px 18px;
  border-bottom: 1px solid var(--color-border-lighter);
  border-right: 1px solid var(--color-border-lighter);

  &:nth-child(2n) {
    border-right: none;
  }

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    border-right: none;
  }
`

export const SC_TxMetaLabel = styled.div`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
`

export const SC_TxMetaValue = styled.div`
  font-size: 14px;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
  word-break: break-all;
`

export const SC_TxIOGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 40px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-lighter);
  border-radius: var(--ui-radius-lg);
  padding: 18px;
  margin-bottom: 24px;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    grid-template-columns: 1fr;
  }
`

export const SC_TxIOColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const SC_TxIOHeader = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  margin: 0 0 4px;
`

export const SC_TxIOItem = styled.div`
  padding: 10px 12px;
  background: rgb(var(--ui-bg-elevated-rgb) / 50%);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  font-size: 14px;
`

export const SC_TxIOAddress = styled.div`
  margin-bottom: 4px;
`

export const SC_TxIOValue = styled.div`
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--ui-text-highlighted);
`

export const SC_TxIOAnnotation = styled.div`
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 4px;
`

export const SC_TxArrow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 60px;
  font-size: 18px;
  color: var(--color-text-muted);
`

export const SC_TxRawToggle = styled.button`
  background: transparent;
  color: var(--color-link);
  border: none;
  font-size: 13px;
  cursor: pointer;
  padding: 0;

  &:hover {
    text-decoration: underline;
  }
`

export const SC_TxRawPre = styled.pre`
  margin: 12px 0 0;
  padding: 14px;
  background: var(--color-gray-f1);
  border-radius: var(--ui-radius-lg);
  font-family: var(--font-family-mono);
  font-size: 12px;
  color: var(--color-text-dark);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
`
