import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_StatsCard = styled.section`
  background: var(--ui-bg);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
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
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  margin: 0;
`

export const SC_StatsSubtitle = styled.div`
  font-size: 14px;
  color: var(--ui-text-muted);
  font-variant-numeric: tabular-nums;
`

/** Вкладки-pill Nuxt UI: подложка elevated, активная — заливка акцентом. */
export const SC_StatsToggle = styled.div`
  display: inline-flex;
  gap: 2px;
  padding: 4px;
  background: var(--ui-bg-elevated);
  border-radius: var(--ui-radius-lg);
`

export const SC_StatsToggleBtn = styled.button`
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  background: transparent;
  color: var(--ui-text-muted);
  border: none;
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  transition:
    background-color ${TRANSITIONS.QUICK},
    color ${TRANSITIONS.QUICK};

  &.active {
    background: var(--ui-primary);
    color: var(--ui-text-inverted);
    box-shadow: var(--ui-shadow-xs);
  }

  &:hover:not(.active, :disabled) {
    background: transparent;
    color: var(--ui-text-highlighted);
  }

  &:disabled {
    opacity: 0.75;
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
  border-radius: var(--ui-radius-xs);
`

export const SC_StatsPlaceholder = styled.div`
  padding: 32px;
  text-align: center;
  color: ${COLORS.TEXT_MUTED};
  font-size: 13px;
`
