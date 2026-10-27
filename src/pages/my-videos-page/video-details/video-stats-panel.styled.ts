import styled from 'vue3-styled-components'

import { BREAKPOINTS, FONT_SIZE, SPACING } from '@/styles/design-tokens'

export const SC_Stats = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${() => SPACING.MD};
  min-width: 0;
`

export const SC_StatsBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${() => SPACING.SM};
  max-width: 100%;
  overflow-x: auto;
`

export const SC_StatsBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${() => SPACING.LG};
  transition: opacity var(--transition-fast);

  /* Новый период грузится — прежние цифры видны, но приглушены. */
  &.refreshing {
    opacity: 0.55;
  }
`

export const SC_Tiles = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: ${() => SPACING.SM};

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`

const TILE = `
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
  padding: 10px 12px;
  text-align: left;
  background: var(--ui-bg-muted);
  border: 1px solid transparent;
  border-radius: var(--ui-radius-lg);

  span {
    color: var(--ui-text-muted);
    font-size: 12px;
  }

  strong {
    color: var(--ui-text-highlighted);
    font-size: 20px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
`

/** Сводная цифра. */
export const SC_Tile = styled.div`
  ${() => TILE}
`

/** Цифра, которая выбирает график: «Зрители» или «Время просмотра». */
export const SC_MetricTile = styled.button`
  ${() => TILE}
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast);

  &:hover {
    border-color: var(--ui-border);
  }

  &.selected {
    background: var(--ui-bg);
    border-color: var(--ui-chart);
    box-shadow: inset 0 -2px 0 var(--ui-chart);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
    outline-offset: 2px;
  }
`

export const SC_StatsSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${() => SPACING.XS};
  min-width: 0;
`

export const SC_StatsTitle = styled.h3`
  margin: 0;
  color: var(--ui-text-highlighted);
  font-size: ${() => FONT_SIZE.MD};
  font-weight: 600;
`

export const SC_StatsHint = styled.p`
  margin: 0;
  color: var(--ui-text-muted);
  font-size: ${() => FONT_SIZE.SM};
  line-height: calc(1.5 * var(--leading-scale));
`

export const SC_StatsNote = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${() => SPACING.SM};
  padding: ${() => SPACING.MD} 0;
  color: var(--ui-text-muted);
  font-size: ${() => FONT_SIZE.MD};

  &.error {
    color: var(--ui-error);
  }
`

/** Страны: название, полоска доли, число зрителей. */
export const SC_Countries = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: grid;
    grid-template-columns: minmax(0, 160px) minmax(0, 1fr) auto;
    align-items: center;
    gap: ${() => SPACING.SM};
    font-size: ${() => FONT_SIZE.SM};
  }

  span {
    overflow: hidden;
    color: var(--ui-text-highlighted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: var(--ui-text-highlighted);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
`

export const SC_CountryBar = styled.div`
  height: 8px;
  overflow: hidden;
  background: var(--ui-bg-muted);
  border-radius: var(--ui-radius-full);
`

export const SC_CountryFill = styled('div', { share: String })`
  width: ${(p) => p.share || '0%'};
  height: 100%;
  background: var(--ui-chart);
  border-radius: var(--ui-radius-full);
`
