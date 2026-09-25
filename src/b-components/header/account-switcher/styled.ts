import styled from 'vue3-styled-components'

export const SC_AccountSwitcher = styled.div`
  padding: 20px 0;
`

export const SC_EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: var(--color-text-muted);
`

/** Прелоадер списка аккаунтов — пока идёт расшифровка/дозагрузка профилей. */
export const SC_AccountsLoading = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
`

export const SC_AccountsList = styled.div`
  margin-bottom: 20px;
`

export const SC_AccountItem = styled.div<{ active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--ui-radius-lg);
  cursor: pointer;
  transition: background-color var(--transition-fast);
  margin-bottom: 8px;
  ${(p) =>
    p.active &&
    `
      background-color: rgb(var(--ui-primary-rgb) / 8%);
      border: 1px solid var(--color-primary-light-30);
    `}

  &:hover {
    background-color: var(--color-overlay-4);
  }
`

export const SC_AccountItemContent = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
`

export const SC_AccountInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
`

export const SC_AccountName = styled.div`
  font-size: 16px;
  font-weight: 500;
  color: var(--ui-text-highlighted);
`

export const SC_AccountBalance = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
`

export const SC_AccountLoading = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
  font-style: italic;
`

export const SC_AccountBadge = styled.div`
  font-size: 12px;
  color: var(--ui-primary);
  font-weight: 500;
  padding: 4px 8px;
  background-color: rgb(var(--ui-primary-rgb) / 8%);
  border-radius: var(--ui-radius-sm);
`

export const SC_AddAccountSection = styled.div`
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--color-overlay-10);
`

export const SC_AccountActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

export const SC_KeyIcon = styled.div`
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-red-ant);
  font-size: 20px;
  transition:
    opacity var(--transition-fast),
    transform var(--transition-fast);

  &:hover {
    opacity: 0.8;
    transform: scale(1.1);
  }

  img {
    width: 20px;
    height: 20px;
    filter: brightness(0) saturate(100%) invert(27%) sepia(96%) saturate(7471%) hue-rotate(347deg)
      brightness(100%) contrast(101%);
  }

  svg {
    width: 20px;
    height: 20px;
  }
`

export const SC_LogoutIcon = styled.div`
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ui-primary);
  font-size: 20px;
  transition:
    opacity var(--transition-fast),
    transform var(--transition-fast);

  &:hover {
    opacity: 0.8;
    transform: scale(1.1);
  }

  svg {
    width: 20px;
    height: 20px;
  }
`

export const SC_WarningBox = styled.div`
  margin-bottom: 16px;
  padding: 12px;
  background-color: var(--color-warning-bg);
  border: 1px solid var(--color-warning-border);
  border-radius: var(--ui-radius-sm);
`

export const SC_WarningTitleText = styled.p`
  margin: 0;
  color: var(--color-warning-text);
  font-weight: 500;
`

export const SC_WarningBodyText = styled.p`
  margin: 8px 0 0;
  color: var(--color-warning-text);
`
