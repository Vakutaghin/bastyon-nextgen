import styled from 'vue3-styled-components'

export const SC_AccountSwitcher = styled.div`
  padding: 20px 0;
`

export const SC_EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: rgba(0, 0, 0, 0.45);
`

export const SC_AccountsList = styled.div`
  margin-bottom: 20px;
`

export const SC_AccountItem = styled.div<{ active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-bottom: 8px;
  ${(p) => (
    p.active && `
      background-color: rgba(24, 144, 255, 0.1);
      border: 1px solid rgba(24, 144, 255, 0.3);
    `
  )}

  &:hover {
    background-color: rgba(0, 0, 0, 0.04);
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
  color: var(--text-primary, #000);
`

export const SC_AccountBalance = styled.div`
  font-size: 12px;
  color: var(--text-secondary, #666);
`

export const SC_AccountLoading = styled.div`
  font-size: 12px;
  color: var(--text-secondary, #999);
  font-style: italic;
`

export const SC_AccountBadge = styled.div`
  font-size: 12px;
  color: #1890ff;
  font-weight: 500;
  padding: 4px 8px;
  background-color: rgba(24, 144, 255, 0.1);
  border-radius: 4px;
`

export const SC_AddAccountSection = styled.div`
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
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
  color: #ff4d4f;
  font-size: 20px;
  transition: opacity 0.2s, transform 0.2s;

  &:hover {
    opacity: 0.8;
    transform: scale(1.1);
  }

  img {
    width: 20px;
    height: 20px;
    filter: brightness(0) saturate(100%) invert(27%) sepia(96%) saturate(7471%) hue-rotate(347deg) brightness(100%) contrast(101%);
  }

  :deep(svg) {
    width: 20px;
    height: 20px;
  }
`

export const SC_LogoutIcon = styled.div`
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1890ff;
  font-size: 20px;
  transition: opacity 0.2s, transform 0.2s;

  &:hover {
    opacity: 0.8;
    transform: scale(1.1);
  }

  :deep(svg) {
    width: 20px;
    height: 20px;
  }
`
