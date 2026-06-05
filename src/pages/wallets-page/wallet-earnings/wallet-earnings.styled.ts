import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_Earnings = styled.div`
  padding: 8px 0;
`

export const SC_EarningsTitle = styled.h3`
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_EarningsCards = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
`

export const SC_EarningsCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  border: 1px solid ${COLORS.BORDER_DEFAULT};
  border-radius: 8px;
  background: ${COLORS.BG_SECONDARY};
`

export const SC_EarningsLabel = styled.span`
  font-size: 13px;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_EarningsValue = styled.span`
  font-size: 18px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_EarningsUnit = styled.span`
  font-size: 12px;
  font-weight: 400;
  color: ${COLORS.TEXT_MUTED};
  margin-left: 4px;
`

export const SC_EarningsState = styled.div`
  padding: 24px 0;
  text-align: center;
  color: ${COLORS.TEXT_SECONDARY};
  font-size: 14px;
`
