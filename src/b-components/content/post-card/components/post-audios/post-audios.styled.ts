import styled from 'vue3-styled-components'

import { noSelect } from '@/styles/chrome-styles'

/** Аудио-пост с несколькими записями: обложка с кнопкой, под ней — список. */
export const SC_Album = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
`

export const SC_AlbumHead = styled.div`
  ${noSelect}
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`

export const SC_AlbumCover = styled.button`
  position: relative;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: var(--ui-radius-md);
  background: var(--ui-bg-muted);
  color: var(--ui-text-muted);
  font-size: 26px;
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-overlay-40);
    color: var(--color-white);
    font-size: 26px;
  }

  &:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: 2px;
  }
`

export const SC_AlbumInfo = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;

  .now {
    overflow: hidden;
    color: var(--ui-text-highlighted);
    font-size: 15px;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta {
    color: var(--ui-text-muted);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }

  .error {
    color: var(--ui-error);
    font-size: 13px;
  }
`

/** Место в записи; тянуть можно. */
export const SC_Seek = styled('input', { progress: Number })`
  width: 100%;
  height: 4px;
  margin: 4px 0 2px;
  appearance: none;
  border-radius: var(--ui-radius-full);
  background: linear-gradient(
    to right,
    var(--ui-primary) ${(p) => p.progress ?? 0}%,
    var(--ui-border) ${(p) => p.progress ?? 0}%
  );
  cursor: pointer;

  &::-webkit-slider-thumb {
    width: 12px;
    height: 12px;
    appearance: none;
    border-radius: 50%;
    background: var(--ui-primary);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: 3px;
  }
`

export const SC_Tor = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: var(--ui-text-muted);
  font-size: 13px;
`

export const SC_Rows = styled.ol`
  ${noSelect}
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const SC_Row = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 36px;
  padding: 4px 8px;
  border: 0;
  border-radius: var(--ui-radius-md);
  background: none;
  color: var(--ui-text);
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: var(--ui-bg-muted);
  }

  &.current {
    background: rgb(var(--ui-primary-rgb) / 8%);
    color: var(--ui-text-highlighted);
    font-weight: 500;
  }

  &:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: -2px;
  }

  .title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .duration {
    flex: none;
    color: var(--ui-text-muted);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
`

export const SC_RowIcon = styled.span`
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 22px;
  color: var(--ui-primary);

  .number {
    color: var(--ui-text-muted);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
`

export const SC_More = styled.button`
  align-self: flex-start;
  padding: 4px 8px;
  border: 0;
  border-radius: var(--ui-radius-md);
  background: none;
  color: var(--ui-primary);
  font: inherit;
  font-size: 14px;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
`
