import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

// Левый нижний угол — там, где была кнопка сжатия: правый занимает мессенджер.
// Слой как у мессенджера: над страницей, под окнами и подсказками.
export const SC_Panel = styled.section`
  position: fixed;
  left: 16px;
  bottom: 16px;
  z-index: 1000;
  width: 340px;
  max-width: calc(100vw - 32px);
  background: var(--ui-bg);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  box-shadow: var(--ui-shadow);
  overflow: hidden;

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    left: 8px;
    right: 8px;
    width: auto;
    max-width: none;
    bottom: calc(var(--bottom-nav-height-total) + 8px);
  }
`

export const SC_PanelHeader = styled.header`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 8px 10px 14px;
  background: var(--ui-bg-elevated);
`

export const SC_PanelTitle = styled.h2`
  flex: 1;
  margin: 0;
  color: var(--ui-text-highlighted);
  font-size: 14px;
  font-weight: 600;
`

export const SC_IconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: var(--ui-radius-md);
  color: var(--ui-text-muted);
  cursor: pointer;

  &:hover {
    color: var(--ui-text-highlighted);
    background: var(--ui-bg);
  }
`

export const SC_List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 4px 0;
  max-height: 260px;
  overflow-y: auto;
`

export const SC_Row = styled.li`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
`

export const SC_RowMain = styled.button`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  padding: 0;
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  color: inherit;
`

export const SC_RowTitle = styled.span`
  color: var(--ui-text-highlighted);
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_RowStatus = styled.span`
  color: var(--ui-text-muted);
  font-size: 12px;

  &.error {
    color: var(--ui-error);
  }
`

export const SC_RowAction = styled.button`
  flex-shrink: 0;
  padding: 4px 10px;
  background: transparent;
  border: 1px solid var(--ui-primary);
  border-radius: var(--ui-radius-md);
  color: var(--ui-primary);
  font-size: 12px;
  cursor: pointer;
`
