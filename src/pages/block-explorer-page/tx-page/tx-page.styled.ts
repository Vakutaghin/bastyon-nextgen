import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_TxPageWork = styled.div`
  display: flex;
  flex: 1;
  width: 100%;
  background: ${COLORS.BG_PRIMARY};
`

export const SC_TxPagePage = styled.main`
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  /* 60px top clears the fixed app-header. */
  padding: 88px 24px 48px;
`

export const SC_TxBreadcrumb = styled.div`
  margin-bottom: 12px;
  font-size: 13px;
  color: ${COLORS.TEXT_MUTED};

  a {
    color: ${COLORS.LINK};
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
  color: ${COLORS.TEXT_PRIMARY};
  margin: 0;
`

export const SC_TxTypeBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  background: ${COLORS.PRIMARY_LIGHT};
  color: ${COLORS.PRIMARY};
  border-radius: 12px;
`

export const SC_TxMetaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  background: ${COLORS.BG_SECONDARY};
  border: 1px solid ${COLORS.BORDER_LIGHTER};
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 24px;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    grid-template-columns: 1fr;
  }
`

export const SC_TxMetaCell = styled.div`
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

export const SC_TxMetaLabel = styled.div`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: ${COLORS.TEXT_SECONDARY};
  margin-bottom: 6px;
`

export const SC_TxMetaValue = styled.div`
  font-size: 14px;
  color: ${COLORS.TEXT_PRIMARY};
  font-variant-numeric: tabular-nums;
  word-break: break-all;
`

export const SC_TxIOGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 40px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  background: ${COLORS.BG_PRIMARY};
  border: 1px solid ${COLORS.BORDER_LIGHTER};
  border-radius: 10px;
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
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: ${COLORS.TEXT_SECONDARY};
  margin: 0 0 4px;
`

export const SC_TxIOItem = styled.div`
  padding: 10px 12px;
  background: ${COLORS.BG_SECONDARY};
  border: 1px solid ${COLORS.BORDER_LIGHTER};
  border-radius: 8px;
  font-size: 13px;
`

export const SC_TxIOAddress = styled.div`
  margin-bottom: 4px;
`

export const SC_TxIOValue = styled.div`
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_TxIOAnnotation = styled.div`
  font-size: 11px;
  color: ${COLORS.TEXT_MUTED};
  margin-top: 4px;
`

export const SC_TxArrow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 60px;
  font-size: 18px;
  color: ${COLORS.TEXT_MUTED};
`

export const SC_TxRawToggle = styled.button`
  background: transparent;
  color: ${COLORS.LINK};
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
  background: ${COLORS.GRAY_F1};
  border-radius: 8px;
  font-family: 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: ${COLORS.TEXT_DARK};
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
`

export const SC_Placeholder = styled.div`
  padding: 32px;
  text-align: center;
  color: ${COLORS.TEXT_MUTED};
`

export const SC_PlaceholderError = styled(SC_Placeholder)`
  color: ${COLORS.DANGER};
`
