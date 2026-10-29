import styled from 'vue3-styled-components'

/** Версия приложения и проверка обновлений — над списком изменений. */
export const SC_AppVersion = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin-bottom: 20px;
  padding: 12px 16px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  font-size: 14px;
`

export const SC_AppVersionText = styled.div`
  flex: 1;
  min-width: 200px;
  color: var(--ui-text-highlighted);

  & small {
    display: block;
    margin-top: 2px;
    font-size: 13px;
    color: var(--ui-text-muted);
  }
`

export const SC_UpdateButton = styled.button`
  background: transparent;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
  border-radius: var(--ui-radius-sm);
  padding: 3px 12px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color var(--transition-fast);

  &:hover:not(:disabled) {
    background: var(--color-primary-light);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.75;
  }
`
