import styled from 'vue3-styled-components'

export const SC_ChatListRoot = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
`

export const SC_ChatList = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0;
`

/** «Все · Личные · Группы» над списком — стоит на месте, список прокручивается. */
export const SC_ChatFilter = styled.div`
  display: flex;
  flex-shrink: 0;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-bg-hover);
`

export const SC_FilterChip = styled.button`
  padding: 4px 12px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-full);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.4;
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);

  &:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-tertiary);
  }

  &.active {
    border-color: var(--ui-primary);
    background: rgb(var(--ui-primary-rgb) / 10%);
    color: var(--ui-primary);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: 2px;
  }
`
