import styled from 'vue3-styled-components'
import { BREAKPOINTS, Z_INDEX } from '@/styles/design-tokens'

/**
 * На компьютере — карточка в левом нижнем углу: справа внизу мессенджер. На
 * телефоне — полоса над нижней панелью во всю ширину.
 */
export const SC_MiniPlayer = styled.div`
  position: fixed;
  left: 14px;
  bottom: 14px;
  z-index: ${() => Z_INDEX.STICKY};
  width: 400px;
  max-width: calc(100vw - 28px);
  background: var(--ui-bg-elevated);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  box-shadow: var(--ui-shadow-xl);
  overflow: hidden;

  /* Каркас телефона (нижняя панель или колонка разделов сбоку). */
  &.compact {
    left: var(--shell-inset-left, 0);
    right: 0;
    bottom: var(--bottom-nav-height-total);
    width: auto;
    max-width: none;
    border-radius: 0;
    border-left: 0;
    border-right: 0;
    border-bottom: 0;
    box-shadow: var(--ui-shadow-md);
  }
`

/** Полоса места в треке во всю ширину верхнего края; тянуть можно. */
export const SC_Progress = styled('input', { progress: Number })`
  display: block;
  width: 100%;
  height: 4px;
  margin: 0;
  appearance: none;
  background: linear-gradient(
    to right,
    var(--ui-primary) ${(p) => p.progress ?? 0}%,
    var(--ui-border) ${(p) => p.progress ?? 0}%
  );
  cursor: pointer;

  &::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--ui-primary);
    opacity: 0;
  }

  &:hover::-webkit-slider-thumb,
  &:focus-visible::-webkit-slider-thumb {
    opacity: 1;
  }

  &::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border: 0;
    border-radius: 50%;
    background: var(--ui-primary);
  }
`

export const SC_Body = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
`

export const SC_Cover = styled.button`
  flex: none;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: var(--ui-radius-md);
  background: var(--ui-bg-muted);
  color: var(--ui-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  font-size: 20px;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

export const SC_Info = styled.button`
  flex: 1;
  min-width: 0;
  padding: 0;
  border: 0;
  background: none;
  text-align: left;
  cursor: pointer;
  color: inherit;
`

/** Tor включён: вместо названия — что звук пойдёт мимо Tor, и согласие. */
export const SC_TorNote = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  line-height: 1.3;
  color: var(--ui-text-muted);
`

export const SC_Title = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_Artist = styled.div`
  font-size: 12px;
  color: var(--ui-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_Time = styled.span`
  font-variant-numeric: tabular-nums;

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    display: none;
  }
`

export const SC_Controls = styled.div`
  flex: none;
  display: flex;
  align-items: center;
  gap: 2px;
`

export const SC_Control = styled.button`
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--ui-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--ui-bg-muted);
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }

  &.main {
    width: 40px;
    height: 40px;
    background: var(--ui-primary);
    color: var(--ui-text-inverted);
  }

  &.main:hover {
    background: var(--ui-primary-strong);
  }

  &.secondary {
    color: var(--ui-text-muted);
    font-size: 16px;
  }

  &.on {
    color: var(--ui-primary);
  }

  /* Узкий телефон: «предыдущий» прячем — закрыть плеер нужнее. */
  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    &.prev {
      display: none;
    }
  }
`

export const SC_Queue = styled.div`
  border-top: 1px solid var(--ui-border);
  max-height: min(50vh, 420px);
  display: flex;
  flex-direction: column;
`

export const SC_QueueHead = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 10px 4px 14px;
`

export const SC_QueueTitle = styled.div`
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_QueueList = styled.ol`
  margin: 0;
  padding: 0 0 6px;
  list-style: none;
  overflow-y: auto;
`

export const SC_QueueRow = styled.button`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas: 'title duration' 'artist duration';
  column-gap: 8px;
  width: 100%;
  padding: 6px 14px;
  border: 0;
  background: none;
  text-align: left;
  cursor: pointer;
  color: var(--ui-text);

  &:hover {
    background: var(--ui-bg-muted);
  }

  &.current {
    background: rgb(var(--ui-primary-rgb) / 10%);
  }

  &.current .title {
    color: var(--ui-primary);
  }

  .title {
    grid-area: title;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .artist {
    grid-area: artist;
    font-size: 12px;
    color: var(--ui-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .duration {
    grid-area: duration;
    align-self: center;
    font-size: 12px;
    color: var(--ui-text-dimmed);
    font-variant-numeric: tabular-nums;
  }
`
