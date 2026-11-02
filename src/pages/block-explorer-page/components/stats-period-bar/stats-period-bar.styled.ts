import styled from 'vue3-styled-components'
import { BREAKPOINTS, TRANSITIONS } from '@/styles/design-tokens'

/** Период — одной строкой над графиками, которые он задаёт. */
export const SC_PeriodBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  min-width: 0;
`

/** Вкладки-pill Nuxt UI: подложка elevated, выбранная — заливка акцентом. */
export const SC_Segmented = styled.div`
  display: inline-flex;
  gap: 2px;
  padding: 4px;
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
  background: var(--ui-bg-elevated);
  border-radius: var(--ui-radius-lg);

  &::-webkit-scrollbar {
    display: none;
  }
`

export const SC_SegmentButton = styled.button`
  flex-shrink: 0;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
  background: transparent;
  color: var(--ui-text-muted);
  border: none;
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  transition:
    background-color ${() => TRANSITIONS.QUICK},
    color ${() => TRANSITIONS.QUICK};

  &.active {
    background: var(--ui-primary);
    color: var(--ui-text-inverted);
    box-shadow: var(--ui-shadow-xs);
  }

  &:hover:not(.active) {
    color: var(--ui-text-highlighted);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: 1px;
  }
`

export const SC_CustomRange = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--ui-text-muted);

  .ant-picker {
    width: 150px;
    background: var(--ui-bg);
    border-color: var(--ui-border-accented);
  }

  .ant-picker .ant-picker-input > input {
    color: var(--ui-text-highlighted);
    cursor: pointer;
  }

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    width: 100%;

    .ant-picker {
      flex: 1;
      width: auto;
      min-width: 0;
    }
  }
`
