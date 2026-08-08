import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_AccountSwitcher = styled.div`
  padding: 20px 0;
`

export const SC_EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: ${COLORS.TEXT_MUTED};
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
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-bottom: 8px;
  ${(p) =>
    p.active &&
    `
      background-color: ${COLORS.ANT_BLUE_BG_LIGHT};
      border: 1px solid ${COLORS.PRIMARY_LIGHT_30};
    `}

  &:hover {
    background-color: ${COLORS.OVERLAY_4};
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
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_AccountBalance = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_AccountLoading = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};
  font-style: italic;
`

export const SC_AccountBadge = styled.div`
  font-size: 12px;
  color: ${COLORS.ANT_BLUE};
  font-weight: 500;
  padding: 4px 8px;
  background-color: ${COLORS.ANT_BLUE_BG_LIGHT};
  border-radius: 4px;
`

export const SC_AddAccountSection = styled.div`
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid ${COLORS.OVERLAY_10};
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
  color: ${COLORS.RED_ANT};
  font-size: 20px;
  transition:
    opacity 0.2s,
    transform 0.2s;

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
  color: ${COLORS.ANT_BLUE};
  font-size: 20px;
  transition:
    opacity 0.2s,
    transform 0.2s;

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
  background-color: ${COLORS.WARNING_BG};
  border: 1px solid ${COLORS.WARNING_BORDER};
  border-radius: 4px;
`

export const SC_WarningTitleText = styled.p`
  margin: 0;
  color: ${COLORS.WARNING_TEXT};
  font-weight: 500;
`

export const SC_WarningBodyText = styled.p`
  margin: 8px 0 0;
  color: ${COLORS.WARNING_TEXT};
`
