import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_TopCard = styled.section`
  background: ${COLORS.BG_PRIMARY};
  border: 1px solid ${COLORS.BORDER_LIGHTER};
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 24px;
`

export const SC_TopHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid ${COLORS.BORDER_LIGHTER};
`

export const SC_TopTitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

export const SC_TopTitle = styled.h2`
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: ${COLORS.TEXT_PRIMARY};
  margin: 0;
`

export const SC_TopHint = styled.div`
  font-size: 11px;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_TopToggle = styled.button`
  background: transparent;
  border: 1px solid ${COLORS.BORDER_LIGHTER};
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: ${COLORS.TEXT_SECONDARY};
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;

  &:hover {
    color: ${COLORS.PRIMARY};
    border-color: ${COLORS.PRIMARY_LIGHT_30};
    background: ${COLORS.PRIMARY_LIGHT};
  }
`

export const SC_TopRow = styled.div`
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 90px 70px;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  border-bottom: 1px solid ${COLORS.BORDER_LIGHTER};
  font-size: 13px;

  &:last-child { border-bottom: none; }
  &:hover      { background: ${COLORS.OVERLAY_3}; }

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    grid-template-columns: 24px minmax(0, 1fr) 60px;
    & > :nth-child(4) {
      display: none;
    }
  }
`

export const SC_TopRank = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${COLORS.TEXT_MUTED};
  text-align: right;
  font-variant-numeric: tabular-nums;
`

export const SC_TopVolume = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

export const SC_TopCount = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_MUTED};
  text-align: right;
  font-variant-numeric: tabular-nums;
`

export const SC_Placeholder = styled.div`
  padding: 32px;
  text-align: center;
  color: ${COLORS.TEXT_MUTED};
  font-size: 13px;
`
