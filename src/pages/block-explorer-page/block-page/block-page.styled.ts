import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

// Общие примитивы эксплорера (audit §3.1).
export {
  SC_Placeholder,
  SC_PlaceholderError,
  SC_LoadMoreFooter,
  SC_LoadMoreBtn,
} from '../components/shared/explorer-primitives.styled'

export const SC_BlockConfirmationsTip = styled.span`
  font-size: 12px;
  color: var(--color-warning-icon);
`

export const SC_BlockSiblingRow = styled.div`
  margin-bottom: 4px;
`

export const SC_BlockSiblingsEmpty = styled.div`
  color: var(--color-text-muted);
`

export const SC_BlockPageWork = styled.div`
  display: flex;
  flex: 1;
  width: 100%;
  background: var(--color-bg-primary);
`

export const SC_BlockPagePage = styled.main`
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  /* Отступ сверху — высота фиксированной шапки плюс 28px воздуха. */
  padding: calc(var(--header-height-total) + 28px) 24px 48px;
`

export const SC_BlockBreadcrumb = styled.div`
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

export const SC_BlockTitle = styled.h1`
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 16px;
`

export const SC_BlockNav = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
`

export const SC_BlockNavBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 13px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-lighter);
  border-radius: var(--ui-radius-md);
  color: var(--color-text-primary);
  cursor: pointer;

  &:disabled {
    color: var(--color-text-muted);
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background: var(--color-bg-hover);
  }
`

export const SC_BlockMetaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-lighter);
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
  margin-bottom: 24px;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    grid-template-columns: 1fr;
  }
`

export const SC_BlockMetaCell = styled.div`
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

export const SC_BlockMetaLabel = styled.div`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
`

export const SC_BlockMetaValue = styled.div`
  font-size: 14px;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
  word-break: break-all;
`

export const SC_TxSection = styled.section`
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-lighter);
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
`

export const SC_TxSectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--color-border-lighter);
`

export const SC_TxSectionTitle = styled.h2`
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  margin: 0;
`

export const SC_TxSectionPager = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text-secondary);
`

export const SC_TxRow = styled.div`
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr) 110px;
  gap: 12px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--color-border-lighter);
  font-size: 13px;
  align-items: center;

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    /* Card layout: [badge] [value], затем хеш на всю ширину. */
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    padding: 12px 14px;

    & > :nth-child(1) {
      order: 0;
    }

    & > :nth-child(2) {
      order: 2;
      flex-basis: 100%;
      min-width: 0;
    }

    & > :nth-child(3) {
      order: 1;
      margin-left: auto;
    }
  }

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--color-overlay-3);
  }
`

export const SC_TxTypeBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-radius: var(--ui-radius-sm);
  white-space: nowrap;
`

export const SC_TxValue = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
  text-align: right;
  font-variant-numeric: tabular-nums;
`
