import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_Diag = styled.section`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

export const SC_DiagTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_DiagGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

export const SC_DiagGroupTitle = styled.h3`
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${COLORS.TEXT_MUTED};
`

export const SC_DiagRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 7px 0;
  border-bottom: 1px solid ${COLORS.BORDER_LIGHTER};

  &:last-child {
    border-bottom: 0;
  }
`

export const SC_DiagLabel = styled.span`
  font-size: 14px;
  color: ${COLORS.TEXT_SECONDARY};
  flex-shrink: 0;
`

export const SC_DiagValue = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: ${COLORS.TEXT_PRIMARY};
  font-family: ui-monospace, monospace;
  text-align: right;
  word-break: break-all;
`
