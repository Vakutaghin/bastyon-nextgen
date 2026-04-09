import styled, { css } from 'vue3-styled-components'

const sidebarItemProps = { active: Boolean }

export const SC_SettingsWork = styled.div`
  display: flex;
  flex: 1;
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - 60px);
  padding: 0 0 25px;
  align-items: flex-start;
  background: rgb(255, 255, 255);
`

export const SC_SettingsPage = styled.div`
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  padding-top: 60px;
`

export const SC_SettingsContentWrapper = styled.div`
  display: flex;
  width: 100%;
  gap: 24px;
  padding: 0 20px;

  @media (max-width: 800px) {
    flex-direction: column;
    padding: 10px;
  }
`

export const SC_SettingsSidebar = styled.nav`
  flex-shrink: 0;
  width: 220px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 0;

  @media (max-width: 800px) {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 8px;
  }
`

export const SC_SettingsSidebarItem = styled('button', sidebarItemProps)`
  display: block;
  width: 100%;
  padding: 10px 14px;
  text-align: left;
  font-size: 14px;
  line-height: 1.4;
  color: rgb(33, 33, 33);
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: rgba(0, 0, 0, 0.04);
  }

  ${(p: { active?: boolean }) =>
    p.active &&
    css`
      color: rgb(0, 123, 255);
      background: rgba(0, 123, 255, 0.08);
      &:hover {
        background: rgba(0, 123, 255, 0.12);
      }
    `}

  @media (max-width: 800px) {
    width: auto;
    min-width: 120px;
  }
`

export const SC_SettingsMain = styled.main`
  flex: 1;
  min-width: 0;
  background: rgb(255, 255, 255);
  padding: 24px;
  border-radius: 8px;
`

export const SC_SettingsPlaceholder = styled.div`
  font-size: 15px;
  color: rgb(102, 102, 102);
  padding: 20px 0;
`

export const SC_SettingsSectionTitle = styled.h2`
  font-size: 16px;
  font-weight: 600;
  color: rgb(33, 33, 33);
  margin: 0 0 16px;
`

export const SC_NotificationsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

export const SC_NotificationsRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  font-size: 14px;
  color: rgb(33, 33, 33);

  &:last-child {
    border-bottom: none;
  }
`

export const SC_NotificationsRowLabel = styled.span`
  flex: 1;
`

/* ── Private Key section ── */

export const SC_PrivateKeySection = styled.div`
  max-width: 560px;
`

export const SC_PrivateKeyWarning = styled.div`
  padding: 12px 16px;
  background-color: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 13px;
  line-height: 1.5;
  color: #856404;
`

export const SC_PrivateKeyBox = styled.div`
  position: relative;
  background-color: #f5f5f5;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  padding: 16px;
  padding-bottom: 48px;
  margin-bottom: 16px;
`

export const SC_PrivateKeyLabel = styled.div`
  font-size: 13px;
  color: rgba(0, 0, 0, 0.45);
  margin-bottom: 8px;
  font-weight: 600;
`

export const SC_PrivateKeyValue = styled.div`
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  color: #000;
  word-break: break-all;
  user-select: all;
`

export const SC_CopyIconBtn = styled.button`
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fff;
  color: rgba(0, 0, 0, 0.65);
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background 0.2s;

  &:hover {
    color: #1890ff;
    border-color: #1890ff;
    background: #e6f7ff;
  }
`

export const SC_ShowKeyButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  background: #1890ff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #40a9ff;
  }

  &:disabled {
    background: #d9d9d9;
    cursor: not-allowed;
  }
`

export const SC_HideKeyButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.65);
  background: transparent;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;

  &:hover {
    color: #1890ff;
    border-color: #1890ff;
  }
`

export const SC_ConfirmOverlay = styled.div`
  padding: 20px;
  background: #fff;
  border: 1px solid #ffe58f;
  border-radius: 8px;
  max-width: 480px;
`

export const SC_ConfirmTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: #d46b08;
  margin-bottom: 12px;
`

export const SC_ConfirmText = styled.p`
  font-size: 14px;
  line-height: 1.5;
  color: rgb(33, 33, 33);
  margin: 0 0 16px;
`

export const SC_ConfirmButtons = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
`

export const SC_ConfirmBtnPrimary = styled.button`
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  background: #1890ff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #40a9ff;
  }
`

export const SC_ConfirmBtnDefault = styled.button`
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.65);
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;

  &:hover {
    color: #1890ff;
    border-color: #1890ff;
  }
`
