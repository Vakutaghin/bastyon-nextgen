import styled from 'vue3-styled-components'

export const SC_NotificationsWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: background-color 0.2s;
  color: var(--text-primary, #000);

  &:hover {
    background-color: rgba(0, 0, 0, 0.04);
  }
`

export const SC_NotificationsMenu = styled.div`
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06), 0 8px 24px rgba(0, 0, 0, 0.08);
  padding: 8px;
  min-width: 280px;
  max-width: 380px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`

export const SC_NotificationsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 4px 12px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 8px;
`

export const SC_NotificationsTitle = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: #333;
`

export const SC_NotificationsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
`

export const SC_NotificationItem = styled.div<{ $seen?: boolean }>`
  border-radius: 6px;
  padding: 10px 12px;
  background: ${(p) => (p.$seen ? '#fafafa' : 'rgba(24, 144, 255, 0.04)')};
  border: 1px solid ${(p) => (p.$seen ? '#e8e8e8' : 'rgba(24, 144, 255, 0.15)')};
  cursor: pointer;
  transition: background-color 0.15s;

  &:hover {
    background: ${(p) => (p.$seen ? '#f5f5f5' : 'rgba(24, 144, 255, 0.08)')};
  }
`

export const SC_NotificationItemTitle = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: #333;
  margin-bottom: 2px;
  word-break: break-word;
`

export const SC_NotificationItemDesc = styled.div`
  font-size: 12px;
  color: #666;
  word-break: break-word;
`

export const SC_NotificationItemTime = styled.div`
  font-size: 11px;
  color: #999;
  margin-top: 4px;
`

export const SC_EmptyMessage = styled.div`
  padding: 16px;
  text-align: center;
  color: #999;
  font-size: 13px;
`

export const SC_LoaderWrap = styled.div`
  padding: 16px;
  text-align: center;
  color: #999;
`
