import styled from 'vue3-styled-components'

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
