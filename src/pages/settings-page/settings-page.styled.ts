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
