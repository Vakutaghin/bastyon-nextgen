import styled from 'vue3-styled-components'

export const SC_List = styled.ol`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
`

export const SC_Track = styled.li`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 8px;
  border-radius: var(--ui-radius-md);

  &:hover {
    background: var(--ui-bg-muted);
  }

  &.current {
    background: rgb(var(--ui-primary-rgb) / 8%);
  }

  .open {
    flex: none;
    width: 30px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: var(--ui-text-dimmed);
    font-size: 16px;
  }

  .open:hover {
    background: var(--ui-bg-muted);
    color: var(--ui-text);
  }
`

export const SC_PlayOverlay = styled.span`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-overlay-40);
  color: var(--color-white);
  font-size: 18px;
  opacity: 0;
  transition: opacity var(--transition-fast);
`

export const SC_PlayCell = styled.button`
  position: relative;
  flex: none;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: var(--ui-radius-md);
  overflow: hidden;
  background: var(--ui-bg-muted);
  color: var(--ui-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &:hover span:last-child,
  &:focus-visible span:last-child,
  .current & span:last-child {
    opacity: 1;
  }
`

export const SC_Number = styled.span`
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  color: var(--ui-text-muted);
`

export const SC_TrackText = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;

  .artist {
    font-size: 13px;
    color: var(--ui-text-muted);
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    align-self: flex-start;
    max-width: 100%;
  }

  .artist:hover {
    color: var(--ui-text);
  }
`

export const SC_TrackTitle = styled.button`
  padding: 0;
  border: 0;
  background: none;
  text-align: left;
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text-highlighted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;

  .current & {
    color: var(--ui-primary);
  }
`

export const SC_TrackDuration = styled.span`
  flex: none;
  font-size: 13px;
  color: var(--ui-text-dimmed);
  font-variant-numeric: tabular-nums;
`
