import styled from 'vue3-styled-components'
import { BREAKPOINTS, TRANSITIONS } from '@/styles/design-tokens'

export const SC_Topo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--ui-bg);

  &.fullscreen,
  &:fullscreen {
    position: fixed;
    inset: 0;
    z-index: 2000;
    padding: 12px;
  }
`

export const SC_TopoToolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
`

export const SC_TopoSegmented = styled.div`
  display: inline-flex;
  flex-wrap: wrap;
  padding: 2px;
  background: var(--ui-bg-elevated);
  border-radius: var(--ui-radius-md);
`

export const SC_TopoSegment = styled.button`
  padding: 4px 10px;
  border: 0;
  border-radius: var(--ui-radius-sm);
  background: transparent;
  color: var(--ui-text-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background-color ${() => TRANSITIONS.QUICK},
    color ${() => TRANSITIONS.QUICK};

  &:hover {
    color: var(--ui-text-highlighted);
  }

  &.active {
    background: var(--ui-bg);
    color: var(--ui-text-highlighted);
    box-shadow: var(--ui-shadow-sm);
  }
`

export const SC_TopoTools = styled.div`
  display: inline-flex;
  gap: 4px;
  margin-left: auto;
`

export const SC_TopoTool = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  background: var(--ui-bg);
  color: var(--ui-text-muted);
  font-size: 16px;
  cursor: pointer;

  &:hover {
    color: var(--ui-text-highlighted);
    background: var(--ui-bg-elevated);
  }
`

export const SC_TopoStage = styled.div`
  position: relative;
  height: 560px;
  overflow: hidden;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg);

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    height: 440px;
  }

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    height: 380px;
  }

  :fullscreen &,
  .fullscreen & {
    flex: 1;
    height: auto;
  }
`

/** Подложка «Карты» (MapLibre): под холстом, жестов не ловит. */
export const SC_TopoBaseMap = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;

  & > div {
    width: 100%;
    height: 100%;
  }
`

export const SC_TopoCanvas = styled.canvas`
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  /* Один палец листает страницу, двумя — двигают схему (фильтр d3-zoom). */
  touch-action: pan-y;
  cursor: grab;

  &.pointer {
    cursor: pointer;
  }

  &:active {
    cursor: grabbing;
  }
`

export const SC_TopoEvent = styled.div`
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 4px 10px;
  border-radius: var(--ui-radius-full);
  background: var(--color-success-bg-tint);
  color: var(--ui-success);
  font-size: 12px;
  font-weight: 600;
  pointer-events: none;
  animation: topo-event 4s ease forwards;

  @keyframes topo-event {
    0% {
      opacity: 0;
      transform: translateY(-4px);
    }

    8%,
    80% {
      opacity: 1;
      transform: none;
    }

    100% {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

export const SC_TopoLegend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  font-size: 12px;
  color: var(--ui-text-muted);
`

/** Строка легенды — флажок: снятый прячет группу нод на схеме и карте. */
export const SC_TopoLegendItem = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px 3px 6px;
  border: 1px solid transparent;
  border-radius: var(--ui-radius-md);
  background: transparent;
  color: var(--ui-text-highlighted);
  font: inherit;
  cursor: pointer;
  transition:
    background-color ${() => TRANSITIONS.QUICK},
    color ${() => TRANSITIONS.QUICK};

  &:hover {
    background: var(--ui-bg-elevated);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: 1px;
  }

  &.off {
    color: var(--ui-text-dimmed);
  }

  &.off > span:first-child {
    background: transparent;
  }

  &.off > span:first-child::after {
    display: none;
  }
`

/** Квадратик флажка цвета группы, с галочкой. */
export const SC_TopoCheck = styled('span', { color: String })`
  position: relative;
  flex: none;
  width: 14px;
  height: 14px;
  border: 1.5px solid ${(p) => p.color ?? ''};
  border-radius: var(--ui-radius-sm);
  background: ${(p) => p.color ?? ''};

  &::after {
    content: '';
    position: absolute;
    top: 1px;
    left: 3.5px;
    width: 3px;
    height: 7px;
    border: solid var(--ui-bg);
    border-width: 0 1.5px 1.5px 0;
    transform: rotate(45deg);
  }
`

export const SC_TopoLegendCount = styled.span`
  color: var(--ui-text-dimmed);
  font-variant-numeric: tabular-nums;
`

export const SC_TopoLine = styled.span`
  display: inline-block;
  width: 18px;
  height: 0;
  border-top: 1px solid var(--ui-border-accented);

  &.pool {
    border-top: 1px dashed var(--ui-primary);
  }
`

export const SC_TopoPulse = styled.span`
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ui-primary);
`

export const SC_TopoMapNote = styled.div`
  position: absolute;
  bottom: 10px;
  left: 10px;
  max-width: calc(100% - 20px);
  padding: 4px 10px;
  border-radius: var(--ui-radius-full);
  background: var(--ui-bg);
  box-shadow: var(--ui-shadow-sm);
  color: var(--ui-text-muted);
  font-size: 12px;
  pointer-events: none;
`

/** Подпись источников карты — обязательна по условиям OSM и CARTO. */
export const SC_TopoAttribution = styled.div`
  position: absolute;
  right: 0;
  bottom: 0;
  padding: 2px 8px;
  border-top-left-radius: var(--ui-radius-sm);
  background: var(--ui-bg);
  color: var(--ui-text-muted);
  font-size: 11px;

  & a {
    color: inherit;
    text-decoration: underline;
  }
`

export const SC_TopoHint = styled.div`
  font-size: 12px;
  color: var(--ui-text-dimmed);
`

// --- Карточка выбранного узла

export const SC_NodeCard = styled.aside`
  position: absolute;
  top: 12px;
  right: 12px;
  width: 330px;
  max-height: calc(100% - 24px);
  overflow-y: auto;
  padding: 14px 16px;
  background: var(--ui-bg);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  box-shadow: var(--ui-shadow-lg);
  font-size: 13px;

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    inset: auto 8px 8px;
    width: auto;
    max-height: 60%;
  }
`

export const SC_NodeCardHead = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 10px;
`

export const SC_NodeCardTitle = styled.div`
  flex: 1;
  min-width: 0;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  overflow-wrap: anywhere;

  & small {
    display: block;
    margin-top: 2px;
    font-weight: 400;
    color: var(--ui-text-muted);
  }
`

export const SC_NodeCardClose = styled.button`
  flex: none;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: var(--ui-radius-sm);
  background: transparent;
  color: var(--ui-text-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: var(--ui-bg-elevated);
    color: var(--ui-text-highlighted);
  }
`

export const SC_NodeCardRows = styled.dl`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 6px 12px;
  margin: 0;

  & dt {
    display: inline-flex;
    align-items: center;
    color: var(--ui-text-muted);
    white-space: nowrap;
  }

  & dd {
    margin: 0;
    color: var(--ui-text-highlighted);
    text-align: right;
    overflow-wrap: break-word;
  }
`

export const SC_NodeCardNote = styled.p`
  margin: 10px 0 0;
  color: var(--ui-text-muted);
  line-height: 1.45;
`

export const SC_NodeCardActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
`

export const SC_NodeCardAction = styled.button`
  padding: 5px 10px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  background: var(--ui-bg);
  color: var(--ui-text-highlighted);
  font-size: 12px;
  cursor: pointer;

  &:hover {
    background: var(--ui-bg-elevated);
  }

  &:disabled {
    color: var(--ui-text-dimmed);
    cursor: default;
  }
`

export const SC_NodeCardBadge = styled.span`
  display: inline-block;
  padding: 1px 6px;
  border-radius: var(--ui-radius-full);
  font-size: 11px;
  font-weight: 600;
  color: var(--ui-primary);
  background: var(--ui-bg-elevated);
`
