import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_InfoContent = styled.div`
  display: flex !important;
  flex-direction: column !important;
  gap: 16px !important;
`

export const SC_InfoRow = styled.div`
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  padding: 8px 0 !important;
  border-bottom: 1px solid ${COLORS.BG_HOVER} !important;

  &:last-child {
    border-bottom: none !important;
  }
`

export const SC_InfoLabel = styled.div`
  font-weight: 500 !important;
  color: ${COLORS.TEXT_SECONDARY} !important;
  font-size: 16px !important;
`

export const SC_InfoValue = styled.div`
  color: ${COLORS.TEXT_PRIMARY} !important;
  font-size: 16px !important;
  text-align: right !important;
  word-break: break-word !important;
  max-width: 60% !important;
`
