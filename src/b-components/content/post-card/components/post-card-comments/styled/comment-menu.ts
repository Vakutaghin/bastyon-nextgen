import styled from 'vue3-styled-components'

/** Кнопка-триггер контекстного меню комментария (три точки) */
export const SC_MenuTrigger = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 50%;
  cursor: pointer;
  padding: 0;

  &:hover {
    background: var(--color-overlay-6);
    color: var(--color-text-primary);
  }

  svg {
    width: 16px;
    height: 16px;
  }
`

/** Контейнер списка пунктов меню в поповере */
export const SC_MenuList = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 180px;
  padding: 4px;
`

/** Пункт меню */
export const SC_MenuItem = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: none;
  border-radius: var(--ui-radius-md);
  background: transparent;
  font-size: 14px;
  color: var(--ui-text);
  cursor: pointer;
  text-align: left;

  &:hover:not(:disabled) {
    background: var(--ui-bg-elevated);
    color: var(--ui-text-highlighted);
  }

  &:disabled {
    opacity: 0.75;
    cursor: not-allowed;
  }

  &.menu-item--danger,
  &.menu-item--danger:hover:not(:disabled) {
    color: var(--ui-error);
  }

  &.menu-item--danger:hover {
    background: rgb(var(--ui-error-rgb) / 10%);
  }

  svg {
    width: 14px;
    height: 14px;
  }
`
