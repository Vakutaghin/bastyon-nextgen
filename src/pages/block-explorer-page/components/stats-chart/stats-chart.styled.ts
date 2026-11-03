import styled from 'vue3-styled-components'
import { BREAKPOINTS, TRANSITIONS } from '@/styles/design-tokens'

export const SC_ChartCard = styled.section`
  background: var(--ui-bg);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  padding: 18px 20px 16px;
  min-width: 0;

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    padding: 14px 12px 12px;
  }
`

export const SC_ChartHead = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
`

export const SC_ChartTitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`

export const SC_ChartTitle = styled.h2`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  margin: 0;
`

export const SC_ChartSubtitle = styled.div`
  font-size: 13px;
  color: var(--ui-text-muted);
  font-variant-numeric: tabular-nums;
`

export const SC_ChartTools = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`

export const SC_ToolButton = styled.button`
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  background: transparent;
  color: var(--ui-text-muted);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  transition:
    color ${() => TRANSITIONS.QUICK},
    border-color ${() => TRANSITIONS.QUICK};

  &:hover,
  &[aria-pressed='true'] {
    color: var(--ui-text-highlighted);
    border-color: var(--ui-border-accented);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: 1px;
  }
`

export const SC_NoteButton = styled.button`
  padding: 0;
  font: inherit;
  color: var(--ui-primary-text);
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
`

/** Пока данные догружаются, прежний рисунок остаётся, но приглушён. */
export const SC_ChartBody = styled.div`
  position: relative;
  transition: opacity ${() => TRANSITIONS.QUICK};

  &.refreshing {
    opacity: 0.6;
  }
`

export const SC_Plot = styled.div`
  position: relative;
  width: 100%;
  touch-action: pan-y;

  svg {
    display: block;
    width: 100%;
    overflow: visible;
  }

  svg:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: 4px;
    border-radius: var(--ui-radius-sm);
  }
`

export const SC_Tooltip = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  min-width: 160px;
  max-width: 260px;
  padding: 8px 10px;
  background: var(--ui-bg);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  box-shadow: var(--ui-shadow-md);
  pointer-events: none;
  font-size: 12px;
  color: var(--ui-text);
  font-variant-numeric: tabular-nums;
`

export const SC_TooltipDate = styled.div`
  margin-bottom: 6px;
  color: var(--ui-text-muted);
`

export const SC_TooltipRow = styled.div`
  display: grid;
  grid-template-columns: 12px 1fr auto;
  align-items: center;
  gap: 6px;
  line-height: 18px;

  strong {
    font-weight: 600;
    color: var(--ui-text-highlighted);
  }

  &.total {
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px solid var(--ui-border);
  }
`

/** Ключ серии в подсказке — короткая черта её цвета. */
export const SC_TooltipKey = styled('span', { color: String })`
  display: block;
  width: 12px;
  height: 2px;
  border-radius: var(--ui-radius-full);
  background: ${(p: { color?: string }) => p.color ?? 'currentColor'};
`

export const SC_Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  margin-top: 10px;
`

export const SC_LegendItem = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  font-size: 12px;
  color: var(--ui-text);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  user-select: none;
  transition:
    color ${() => TRANSITIONS.QUICK},
    background-color ${() => TRANSITIONS.QUICK};

  &:hover {
    background: var(--ui-bg-elevated);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: 1px;
  }

  &.off {
    color: var(--ui-text-dimmed);
    text-decoration: line-through;
  }
`

/** Ключ в легенде повторяет метку: квадрат у площадей и столбцов, черта у линий. */
export const SC_LegendKey = styled('span', { color: String })`
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: var(--ui-radius-xs);
  background: ${(p: { color?: string }) => p.color ?? 'currentColor'};
  transition: opacity ${() => TRANSITIONS.QUICK};

  &.line {
    height: 2px;
    width: 12px;
  }

  &.off {
    opacity: 0.25;
  }
`

export const SC_Placeholder = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 160px;
  padding: 24px;
  text-align: center;
  color: var(--ui-text-muted);
  font-size: 14px;
`

export const SC_TableWrap = styled.div`
  max-height: 320px;
  overflow: auto;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
`

export const SC_Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  font-variant-numeric: tabular-nums;

  th,
  td {
    padding: 6px 10px;
    text-align: right;
    white-space: nowrap;
    border-bottom: 1px solid var(--ui-border);
  }

  th:first-child,
  td:first-child {
    text-align: left;
  }

  thead th {
    position: sticky;
    top: 0;
    background: var(--ui-bg-elevated);
    color: var(--ui-text-muted);
    font-weight: 500;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }
`
