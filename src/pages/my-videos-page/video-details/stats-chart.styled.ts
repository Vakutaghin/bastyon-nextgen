import styled from 'vue3-styled-components'

import { FONT_SIZE, SPACING } from '@/styles/design-tokens'

export const SC_Chart = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${() => SPACING.XS};
  min-width: 0;
`

/** Поле графика: тонкие отметки, сетка на тон темнее фона, подписи — цветом текста. */
export const SC_Plot = styled.div`
  position: relative;
  width: 100%;
  border-radius: var(--ui-radius-md);
  outline: none;
  touch-action: pan-y;

  &:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
    outline-offset: 2px;
  }

  svg {
    display: block;
    overflow: visible;
  }

  .grid line {
    stroke: var(--ui-border);
    stroke-width: 1;
    shape-rendering: crispEdges;
  }

  .axis text {
    fill: var(--ui-text-muted);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .bar {
    fill: var(--ui-chart);
    transition: opacity var(--transition-fast);
  }

  /* Наведённый столбик остаётся ярким, остальные отходят на второй план. */
  &.hovering .bar:not(.active) {
    opacity: 0.55;
  }

  .line {
    fill: none;
    stroke: var(--ui-chart);
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .area {
    fill: var(--ui-chart);
    fill-opacity: 0.1;
  }

  .crosshair line {
    stroke: var(--ui-text-muted);
    stroke-width: 1;
    shape-rendering: crispEdges;
  }

  .crosshair circle {
    fill: var(--ui-chart);
    stroke: var(--ui-bg);
    stroke-width: 2;
  }
`

/** Значение — крупно, подпись точки — мельче и тише. */
export const SC_Tooltip = styled('div', { atX: Number, atY: Number })`
  position: absolute;
  left: ${(p) => `${p.atX ?? 0}px`};
  top: ${(p) => `${p.atY ?? 0}px`};
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 10px;
  white-space: nowrap;
  pointer-events: none;
  background: var(--ui-bg);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  box-shadow: var(--ui-shadow-md);
  transform: translate(-50%, -100%);

  strong {
    color: var(--ui-text-highlighted);
    font-size: ${() => FONT_SIZE.MD};
    font-weight: 600;
  }

  span {
    color: var(--ui-text-muted);
    font-size: ${() => FONT_SIZE.SM};
  }
`

/** Те же значения таблицей — без наведения и для чтения с экрана. */
export const SC_TableToggle = styled.details`
  font-size: ${() => FONT_SIZE.SM};
  color: var(--ui-text-muted);

  summary {
    width: fit-content;
    cursor: pointer;
  }

  table {
    width: 100%;
    margin-top: ${() => SPACING.SM};
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }

  th,
  td {
    padding: 4px ${() => SPACING.SM};
    text-align: left;
    border-bottom: 1px solid var(--ui-border);
  }

  th {
    color: var(--ui-text-highlighted);
    font-weight: 500;
  }

  td:last-child,
  th:last-child {
    text-align: right;
  }
`
