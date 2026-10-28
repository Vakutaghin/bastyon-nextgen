import styled from 'vue3-styled-components'

export const SC_UpNext = styled.section`
  margin: 16px 0;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
  background: var(--ui-bg);
`

export const SC_Countdown = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 14px;
  background: rgb(var(--ui-primary-rgb) / 8%);
  font-size: 13px;

  strong {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

export const SC_Head = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 8px 8px 8px 14px;
  border-bottom: 1px solid var(--ui-border);

  .titles {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .label {
    font-size: 14px;
    font-weight: 600;
    color: var(--ui-text-highlighted);
  }

  .source {
    font-size: 12px;
    color: var(--ui-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

export const SC_HeadButton = styled.button`
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--ui-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--ui-bg-muted);
    color: var(--ui-text);
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }

  &.on {
    color: var(--ui-primary);
  }
`

export const SC_List = styled.ol`
  margin: 0;
  padding: 4px 0;
  list-style: none;
  max-height: 360px;
  overflow-y: auto;
`

export const SC_Row = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
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

  .cover {
    flex: none;
    width: 72px;
    aspect-ratio: 16 / 9;
    border-radius: var(--ui-radius-sm);
    overflow: hidden;
    background: var(--ui-bg-muted);
  }

  .cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .title {
    font-size: 13px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .artist {
    font-size: 12px;
    color: var(--ui-text-muted);
  }

  .duration {
    flex: none;
    font-size: 12px;
    color: var(--ui-text-dimmed);
    font-variant-numeric: tabular-nums;
  }
`
