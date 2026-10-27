import styled from 'vue3-styled-components'

export const SC_LayoutHint = styled.p`
  margin: -8px 0 12px;
  font-size: 14px;
  line-height: calc(1.45 * var(--leading-scale));
  color: var(--ui-text-muted);
`

export const SC_LayoutList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
`

/** Строка списка; перетаскиваемая — приподнята над остальными. */
export const SC_LayoutRow = styled.li`
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 6px 12px 6px 4px;
  background: var(--ui-bg);
  border-bottom: 1px solid var(--ui-border);
  transition: background-color var(--transition-fast);

  &:last-child {
    border-bottom: 0;
  }

  &.dragging {
    position: relative;
    z-index: 1;
    background: var(--ui-bg-elevated);
    box-shadow: var(--ui-shadow-md);
  }

  /* Скрытый или недоступный пункт — приглушён. */
  &.off .layout-row-icon {
    color: var(--ui-text-dimmed);
  }

  &.off .layout-row-label {
    color: var(--ui-text-muted);
  }
`

/** Ручка: за неё тянут мышью и пальцем, на ней же стрелки клавиатуры. */
export const SC_DragHandle = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: var(--ui-radius-sm);
  background: none;
  color: var(--ui-text-dimmed);
  font-size: 16px;
  cursor: grab;
  touch-action: none;

  &:hover {
    color: var(--ui-text-highlighted);
    background: var(--ui-bg-elevated);
  }

  &:active {
    cursor: grabbing;
  }
`

export const SC_RowIcon = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  font-size: 18px;
  color: var(--ui-text-toned);
`

export const SC_RowText = styled.span`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

export const SC_RowLabel = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text-highlighted);
`

export const SC_RowNote = styled.span`
  font-size: 12px;
  line-height: calc(1.4 * var(--leading-scale));
  color: var(--ui-text-muted);
`

export const SC_LayoutFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin: 10px 0 28px;
  font-size: 12px;
  color: var(--ui-text-muted);
`

export const SC_ResetButton = styled.button`
  padding: 6px 12px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  background: var(--ui-bg);
  color: var(--ui-text-highlighted);
  font-size: 13px;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--ui-bg-elevated);
  }

  &:disabled {
    color: var(--ui-text-dimmed);
    cursor: default;
  }
`
