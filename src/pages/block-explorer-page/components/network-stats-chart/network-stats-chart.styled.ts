import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_StatsCard = styled.section`
  background: ${COLORS.BG_PRIMARY};
  border: 1px solid ${COLORS.BORDER_LIGHTER};
  border-radius: 10px;
  padding: 18px 20px 20px;
  margin-bottom: 24px;
`

export const SC_StatsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
`

export const SC_StatsTitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

export const SC_StatsTitle = styled.h2`
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: ${COLORS.TEXT_PRIMARY};
  margin: 0;
`

export const SC_StatsSubtitle = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};
  font-variant-numeric: tabular-nums;
`

export const SC_StatsToggle = styled.div`
  display: inline-flex;
  border: 1px solid ${COLORS.BORDER_LIGHTER};
  border-radius: 8px;
  overflow: hidden;
`

export const SC_StatsToggleBtn = styled.button`
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  background: ${COLORS.BG_PRIMARY};
  color: ${COLORS.TEXT_SECONDARY};
  border: none;
  cursor: pointer;
  transition:
    background-color ${TRANSITIONS.QUICK},
    color ${TRANSITIONS.QUICK};

  &.active {
    background: ${COLORS.PRIMARY};
    color: ${COLORS.WHITE};
  }

  &:hover:not(.active):not(:disabled) {
    background: ${COLORS.BG_HOVER};
  }

  &:disabled {
    color: ${COLORS.TEXT_MUTED};
    cursor: not-allowed;
  }
`

export const SC_ChartHost = styled.div`
  position: relative;
  width: 100%;

  svg {
    display: block;
    width: 100%;
    height: auto;
  }
`

export const SC_Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_LegendItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`

export const SC_LegendDot = styled.span`
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
`

export const SC_StatsPlaceholder = styled.div`
  padding: 32px;
  text-align: center;
  color: ${COLORS.TEXT_MUTED};
  font-size: 13px;
`

export const SC_StatsTooltip = styled.div`
  position: absolute;
  pointer-events: none;
  padding: 8px 12px;
  font-size: 12px;
  color: ${COLORS.TEXT_PRIMARY};
  background: ${COLORS.BG_PRIMARY};
  border: 1px solid ${COLORS.BORDER};
  border-radius: 6px;
  box-shadow: ${COLORS.SHADOW_MD};
  white-space: nowrap;
  transform: translate(-50%, -100%);
  opacity: 0;
  transition: opacity ${TRANSITIONS.QUICK};

  &.visible {
    opacity: 1;
  }
`
