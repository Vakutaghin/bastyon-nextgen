import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_IpfsCard = styled.div`
  margin-top: 20px;
  padding: 16px;
  border: 1px solid ${COLORS.BORDER_DEFAULT};
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`

export const SC_IpfsHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`

export const SC_IpfsTitle = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_IpfsStatus = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};
  white-space: nowrap;
`

export const SC_IpfsDesc = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_IpfsActions = styled.div`
  display: flex;
`
