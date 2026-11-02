import styled from 'vue3-styled-components'

export const SC_Heatmap = styled.div`
  display: grid;
  grid-template-columns: auto repeat(24, minmax(0, 1fr));
  gap: 2px;
  font-size: 11px;
  color: var(--ui-text-muted);
  font-variant-numeric: tabular-nums;
`

export const SC_DayLabel = styled.div`
  padding-right: 6px;
  line-height: 18px;
  white-space: nowrap;
`

export const SC_HourLabel = styled.div`
  text-align: left;
  line-height: 16px;
  white-space: nowrap;
  overflow: visible;
`

/**
 * Ячейка: один оттенок, от светлого к насыщенному (последовательная шкала),
 * подмешанный к фону. Ступени — классами, чтобы не плодить стилей на значение.
 */
export const SC_Cell = styled.div`
  height: 18px;
  border-radius: var(--ui-radius-xs);
  background: var(--ui-bg-elevated);

  &.l1 {
    background: color-mix(in oklab, var(--ui-series-1) 12%, var(--ui-bg));
  }

  &.l2 {
    background: color-mix(in oklab, var(--ui-series-1) 24%, var(--ui-bg));
  }

  &.l3 {
    background: color-mix(in oklab, var(--ui-series-1) 36%, var(--ui-bg));
  }

  &.l4 {
    background: color-mix(in oklab, var(--ui-series-1) 48%, var(--ui-bg));
  }

  &.l5 {
    background: color-mix(in oklab, var(--ui-series-1) 60%, var(--ui-bg));
  }

  &.l6 {
    background: color-mix(in oklab, var(--ui-series-1) 72%, var(--ui-bg));
  }

  &.l7 {
    background: color-mix(in oklab, var(--ui-series-1) 86%, var(--ui-bg));
  }

  &.l8 {
    background: var(--ui-series-1);
  }

  &:hover {
    outline: 2px solid var(--ui-text-highlighted);
    outline-offset: -1px;
  }
`

export const SC_HeatNote = styled.div`
  margin-top: 10px;
  font-size: 12px;
  color: var(--ui-text-muted);
`
