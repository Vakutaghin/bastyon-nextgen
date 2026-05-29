import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { SPACING } from '@/styles/design-tokens'

export const SC_Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.MD};
`

export const SC_AppRow = styled.div`
  color: ${COLORS.GRAY_120};
  font-size: 13px;
`

export const SC_RecieverList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.XS};
  border: 1px solid ${COLORS.GRAY_E0};
  border-radius: 8px;
  padding: ${SPACING.SM};
`

export const SC_RecieverRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${SPACING.MD};
  font-size: 14px;
`

export const SC_RecieverAddr = styled.span`
  font-family: ui-monospace, monospace;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
  color: ${COLORS.GRAY_120};
`

export const SC_RecieverAmount = styled.span`
  font-weight: 600;
  white-space: nowrap;
`

export const SC_TotalRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 15px;
  font-weight: 600;
`

export const SC_TotalAmount = styled.span`
  color: ${COLORS.PRIMARY};
`

export const SC_FeeRow = styled.div`
  font-size: 12px;
  color: ${COLORS.GRAY_120};
`

export const SC_MessageRow = styled.div`
  font-size: 13px;
  color: ${COLORS.GRAY_120};
  padding: ${SPACING.SM};
  background: ${COLORS.GRAY_F1};
  border-radius: 6px;
`

export const SC_Error = styled.div`
  color: ${COLORS.DANGER};
  font-size: 13px;
`
