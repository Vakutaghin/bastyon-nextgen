import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_ExplorerWork = styled.div`
  display: flex;
  flex: 1;
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - 60px);
  align-items: flex-start;
  background: ${COLORS.BG_PRIMARY};
`

export const SC_ExplorerPage = styled.main`
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  // 60px top clears the fixed app-header; remaining 28px is visual gap before content.
  padding: 88px 24px 48px;
`

export const SC_ExplorerHeader = styled.header`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 32px;
`

export const SC_ExplorerTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`

export const SC_ExplorerTitle = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: ${COLORS.TEXT_PRIMARY};
  margin: 0;
  letter-spacing: -0.5px;
`

export const SC_LiveBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  border-radius: 12px;
  color: ${COLORS.TEXT_MUTED};
  background: ${COLORS.BG_DISABLED};
  transition:
    background-color 0.2s ease,
    color 0.2s ease;

  &.active {
    color: ${COLORS.SUCCESS};
    background: ${COLORS.SUCCESS_BG_TINT};
  }
`

export const SC_LiveDot = styled.span`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${COLORS.TEXT_MUTED};

  &.active {
    background: ${COLORS.SUCCESS};
    animation: live-pulse 1.6s ease-in-out infinite;
  }

  @keyframes live-pulse {
    0%,
    100% {
      box-shadow: 0 0 0 0 ${COLORS.SUCCESS_BG_PULSE};
    }
    50% {
      box-shadow: 0 0 0 6px transparent;
    }
  }
`

export const SC_ExplorerSubtitle = styled.p`
  font-size: 14px;
  color: ${COLORS.TEXT_SECONDARY};
  margin: 0;
`

export const SC_ExplorerGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    grid-template-columns: 1fr;
  }
`

export const SC_ExplorerStatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 24px;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`

export const SC_StatCard = styled.div`
  padding: 16px 18px;
  background: ${COLORS.BG_SECONDARY};
  border: 1px solid ${COLORS.BORDER_LIGHTER};
  border-radius: 10px;
`

export const SC_StatCardLabel = styled.div`
  font-size: 11px;
  color: ${COLORS.TEXT_SECONDARY};
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 6px;
`

export const SC_StatCardValue = styled.div`
  font-size: 18px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
  font-variant-numeric: tabular-nums;
`

export const SC_StatCardHint = styled.div`
  font-size: 11px;
  color: ${COLORS.TEXT_MUTED};
  margin-top: 4px;
`

export const SC_SectionCard = styled.section`
  background: ${COLORS.BG_PRIMARY};
  border: 1px solid ${COLORS.BORDER_LIGHTER};
  border-radius: 10px;
  overflow: hidden;
`

export const SC_SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid ${COLORS.BORDER_LIGHTER};
`

export const SC_SectionTitle = styled.h2`
  font-size: 14px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin: 0;
`

export const SC_SectionAction = styled.button`
  background: transparent;
  border: none;
  font-size: 12px;
  color: ${COLORS.LINK};
  cursor: pointer;
  padding: 4px 6px;

  &:hover {
    text-decoration: underline;
  }
`

export const SC_RowList = styled.div`
  display: flex;
  flex-direction: column;
`

export const SC_BlockRow = styled.div`
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr) 70px 110px;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  border-bottom: 1px solid ${COLORS.BORDER_LIGHTER};
  font-size: 13px;

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    /* Card layout: [height] [ntx] [age], затем [hash] на новой строке. */
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    column-gap: 10px;
    row-gap: 6px;
    padding: 12px 14px;

    & > :nth-child(1) {
      order: 0;
    } /* height */
    & > :nth-child(2) {
      order: 3;
      flex-basis: 100%;
      min-width: 0;
    } /* hash */
    & > :nth-child(3) {
      order: 1;
      margin-left: auto;
    } /* ntx */
    & > :nth-child(4) {
      order: 2;
    } /* age */
  }

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${COLORS.OVERLAY_3};
  }
`

export const SC_BlockHeight = styled.div`
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
  font-variant-numeric: tabular-nums;
`

export const SC_BlockNtx = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};
  text-align: right;
`

export const SC_BlockAge = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_MUTED};
  text-align: right;
  white-space: nowrap;
`

export const SC_LoadingPlaceholder = styled.div`
  padding: 24px;
  text-align: center;
  color: ${COLORS.TEXT_MUTED};
  font-size: 13px;
`

export const SC_ErrorPlaceholder = styled.div`
  padding: 24px;
  text-align: center;
  color: ${COLORS.DANGER};
  font-size: 13px;
`
