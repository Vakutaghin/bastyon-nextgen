import styled from 'vue3-styled-components'
import { RouterLink } from 'vue-router'
import { COLORS } from '@/styles/theme-colors'
import { BREAKPOINTS } from '@/styles/design-tokens'

// Общие примитивы эксплорера (audit §3.1).
export {
  SC_InlineLink,
  SC_Placeholder,
  SC_PlaceholderError,
  SC_LoadMoreFooter,
  SC_LoadMoreBtn,
} from '../components/shared/explorer-primitives.styled'

export const SC_InlineLinkInherit = styled(RouterLink)`
  color: inherit;
  text-decoration: none;
`

export const SC_AddrPageWork = styled.div`
  display: flex;
  flex: 1;
  width: 100%;
  background: ${COLORS.BG_PRIMARY};
`

export const SC_AddrPagePage = styled.main`
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  /* 60px top clears the fixed app-header. */
  padding: 88px 24px 48px;
`

export const SC_AddrBreadcrumb = styled.div`
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

export const SC_AddrTitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin: 0 0 16px;
  flex-wrap: wrap;
`

export const SC_AddrTitle = styled.h1`
  font-size: 22px;
  font-weight: 700;
  color: ${COLORS.TEXT_PRIMARY};
  margin: 0;
  min-width: 0;
  flex: 1;
`

export const SC_AddrTitleActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

export const SC_AddrSummary = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 24px;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    grid-template-columns: 1fr;
  }
`

export const SC_AddrSummaryCard = styled.div`
  padding: 16px 18px;
  background: ${COLORS.BG_SECONDARY};
  border: 1px solid ${COLORS.BORDER_LIGHTER};
  border-radius: 10px;
`

export const SC_AddrSummaryLabel = styled.div`
  font-size: 11px;
  color: ${COLORS.TEXT_SECONDARY};
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 6px;
`

export const SC_AddrSummaryValue = styled.div`
  font-size: 18px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
  font-variant-numeric: tabular-nums;
  word-break: break-all;
`

export const SC_AddrSummaryValueProfile = styled(SC_AddrSummaryValue)`
  font-size: 14px;
  font-weight: 500;
`

export const SC_AddrTxSection = styled.section`
  background: ${COLORS.BG_PRIMARY};
  border: 1px solid ${COLORS.BORDER_LIGHTER};
  border-radius: 10px;
  overflow: hidden;
`

export const SC_AddrTxSectionHeader = styled.div`
  padding: 14px 18px;
  border-bottom: 1px solid ${COLORS.BORDER_LIGHTER};
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_AddrTxRow = styled.div`
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr) 110px 110px;
  gap: 12px;
  padding: 12px 18px;
  border-bottom: 1px solid ${COLORS.BORDER_LIGHTER};
  font-size: 13px;
  align-items: center;

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    /* Card layout: [badge] [age], затем [hash], затем [block #]. */
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    padding: 12px 14px;

    & > :nth-child(1) {
      order: 0;
    } /* badge */
    & > :nth-child(2) {
      order: 2;
      flex-basis: 100%;
      min-width: 0;
    } /* hash */
    & > :nth-child(3) {
      order: 3;
      flex-basis: 100%;
      text-align: left;
    } /* block # */
    & > :nth-child(4) {
      order: 1;
      margin-left: auto;
    } /* age */
  }

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${COLORS.OVERLAY_3};
  }
`

export const SC_AddrTxTypeBadge = styled.span`
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

export const SC_AddrTxAge = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_MUTED};
  text-align: right;
  white-space: nowrap;
`

export const SC_AddrTxBlock = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};
  font-variant-numeric: tabular-nums;
  text-align: right;
`

