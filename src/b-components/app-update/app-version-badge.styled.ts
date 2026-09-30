import styled from 'vue3-styled-components'

// Номер версии с кнопкой проверки обновлений: внизу левой панели и в шапке
// мобильного меню. Размер кнопки место задаёт через --version-button-size.

export const SC_VersionBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;

  &.compact {
    justify-content: center;
  }
`

export const SC_VersionText = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  color: var(--ui-text-dimmed);
  transition: color var(--transition-quick);

  &.success {
    color: var(--ui-success);
  }

  &.warning {
    color: var(--ui-warning);
  }

  &.accent {
    color: var(--ui-primary);
  }
`

export const SC_UpdateButton = styled.button`
  flex-shrink: 0;
  width: var(--version-button-size, 28px);
  height: var(--version-button-size, 28px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: var(--ui-radius-md);
  font-size: 14px;
  color: var(--ui-text-dimmed);
  cursor: pointer;
  transition:
    background-color var(--transition-quick),
    color var(--transition-quick);
  -webkit-tap-highlight-color: transparent;

  &:hover:not(:disabled) {
    background: var(--ui-bg-elevated);
    color: var(--ui-text);
  }

  &:disabled {
    cursor: default;
  }

  &.success {
    color: var(--ui-success);
  }

  &.warning {
    color: var(--ui-warning);
  }

  &.accent,
  &.accent:hover:not(:disabled) {
    color: var(--ui-primary);
  }
`
