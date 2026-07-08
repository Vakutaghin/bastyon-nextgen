import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_SecurityCard = styled.div`
  margin-top: 20px;
  padding: 16px;
  border: 1px solid ${COLORS.BORDER_DEFAULT};
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`

export const SC_SecurityLevel = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_SecurityDesc = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_SecurityForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const SC_SecurityWarning = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: ${COLORS.DANGER};
`

export const SC_SecurityFieldError = styled.div`
  font-size: 12px;
  color: ${COLORS.DANGER};
`
