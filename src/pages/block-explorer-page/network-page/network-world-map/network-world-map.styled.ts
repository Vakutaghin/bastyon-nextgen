import styled from 'vue3-styled-components'
import { TRANSITIONS } from '@/styles/design-tokens'

/** Высота — 0,47 ширины, как у проекции Natural Earth без Антарктиды. */
export const SC_Map = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 100 / 47;
`

export const SC_MapCanvas = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
`

export const SC_MapSvg = styled.svg`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
`

export const SC_MapBubble = styled.circle`
  fill: var(--ui-primary);
  fill-opacity: 0.55;
  stroke: var(--ui-primary);
  stroke-width: 1.5;
  cursor: pointer;
  outline: none;
  transition:
    fill-opacity ${() => TRANSITIONS.QUICK},
    opacity ${() => TRANSITIONS.QUICK};

  &:hover,
  &:focus-visible,
  &.active {
    fill-opacity: 0.85;
    stroke: var(--ui-text-highlighted);
  }

  &.dimmed {
    opacity: 0.35;
  }
`

export const SC_MapCount = styled.text`
  fill: var(--ui-bg);
  font-size: 11px;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: central;
  pointer-events: none;
`

export const SC_MapTipBox = styled.rect`
  fill: var(--ui-text-highlighted);
  opacity: 0.92;
`

export const SC_MapTipText = styled.text`
  fill: var(--ui-bg);
  font-size: 12px;
  font-weight: 500;
  text-anchor: middle;
`
