import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

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
  border-bottom: 1px solid ${COLORS.OVERLAY_6};
  font-size: 14px;
  color: ${COLORS.GRAY_212};

  &:last-child {
    border-bottom: none;
  }
`

export const SC_NotificationsRowLabel = styled.span`
  flex: 1;
`
