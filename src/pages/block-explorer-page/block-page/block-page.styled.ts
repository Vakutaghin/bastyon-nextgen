import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_BlockPageWork = styled.div`
  display: flex;
  flex: 1;
  width: 100%;
  background: ${COLORS.BG_PRIMARY};
`

export const SC_BlockPagePage = styled.div`
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  // 60px top clears the fixed app-header.
  padding: 88px 24px 48px;
`

export const SC_BlockBreadcrumb = styled.div`
  margin-bottom: 12px;
  font-size: 13px;
  color: ${COLORS.TEXT_MUTED};

  a {
    color: ${COLORS.LINK};
    text-decoration: none;

    &:hover { text-decoration: underline; }
  }
`

export const SC_BlockTitle = styled.h1`
  font-size: 24px;
  font-weight: 700;
  color: ${COLORS.TEXT_PRIMARY};
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
  background: ${COLORS.BG_SECONDARY};
  border: 1px solid ${COLORS.BORDER_LIGHTER};
  border-radius: 6px;
  color: ${COLORS.TEXT_PRIMARY};
  cursor: pointer;

  &:disabled {
    color: ${COLORS.TEXT_MUTED};
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background: ${COLORS.BG_HOVER};
  }
`

export const SC_BlockMetaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  background: ${COLORS.BG_SECONDARY};
  border: 1px solid ${COLORS.BORDER_LIGHTER};
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 24px;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    grid-template-columns: 1fr;
  }
`

export const SC_BlockMetaCell = styled.div`
  padding: 14px 18px;
  border-bottom: 1px solid ${COLORS.BORDER_LIGHTER};
  border-right: 1px solid ${COLORS.BORDER_LIGHTER};

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
  color: ${COLORS.TEXT_SECONDARY};
  margin-bottom: 6px;
`

export const SC_BlockMetaValue = styled.div`
  font-size: 14px;
  color: ${COLORS.TEXT_PRIMARY};
  font-variant-numeric: tabular-nums;
  word-break: break-all;
`

export const SC_TxSection = styled.section`
  background: ${COLORS.BG_PRIMARY};
  border: 1px solid ${COLORS.BORDER_LIGHTER};
  border-radius: 10px;
  overflow: hidden;
`

export const SC_TxSectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid ${COLORS.BORDER_LIGHTER};
`

export const SC_TxSectionTitle = styled.h2`
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: ${COLORS.TEXT_PRIMARY};
  margin: 0;
`

export const SC_TxSectionPager = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_TxRow = styled.div`
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr) 110px;
  gap: 12px;
  padding: 12px 18px;
  border-bottom: 1px solid ${COLORS.BORDER_LIGHTER};
  font-size: 13px;
  align-items: center;

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    /* Card layout: [badge] [value], затем хеш на всю ширину. */
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    column-gap: 12px;
    row-gap: 6px;
    padding: 12px 14px;

    & > :nth-child(1) { order: 0; }
    & > :nth-child(2) { order: 2; flex-basis: 100%; min-width: 0; }
    & > :nth-child(3) { order: 1; margin-left: auto; }
  }

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${COLORS.OVERLAY_3};
  }
`

export const SC_TxTypeBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  background: ${COLORS.PRIMARY_LIGHT};
  color: ${COLORS.PRIMARY};
  border-radius: 4px;
  white-space: nowrap;
`

export const SC_TxValue = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};
  text-align: right;
  font-variant-numeric: tabular-nums;
`

export const SC_LoadMoreFooter = styled.div`
  display: flex;
  justify-content: center;
  padding: 14px 18px;
  border-top: 1px solid ${COLORS.BORDER_LIGHTER};
`

export const SC_LoadMoreBtn = styled.button`
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 500;
  color: ${COLORS.PRIMARY};
  background: ${COLORS.BG_PRIMARY};
  border: 1px solid ${COLORS.PRIMARY_LIGHT_30};
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;

  &:hover:not(:disabled) {
    background: ${COLORS.PRIMARY_LIGHT};
    border-color: ${COLORS.PRIMARY_LIGHT_50};
  }

  &:disabled {
    color: ${COLORS.TEXT_MUTED};
    background: ${COLORS.BG_DISABLED};
    border-color: ${COLORS.BORDER_LIGHTER};
    cursor: not-allowed;
  }
`

export const SC_Placeholder = styled.div`
  padding: 32px;
  text-align: center;
  color: ${COLORS.TEXT_MUTED};
`

export const SC_PlaceholderError = styled(SC_Placeholder)`
  color: ${COLORS.DANGER};
`
