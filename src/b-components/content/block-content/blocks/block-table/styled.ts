import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_BlockTableWrapper = styled.div`
  margin: 1em 0;
  overflow-x: auto;
`

export const SC_BlockTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  border: 1px solid ${COLORS.GRAY_DDD};
`

export const SC_BlockTableHeaderCell = styled.th`
  padding: 0.75em;
  background-color: ${COLORS.OVERLAY_10};
  font-weight: 600;
  text-align: left;
  border: 1px solid ${COLORS.BORDER_LIGHT};
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_BlockTableCell = styled.td`
  padding: 0.75em;
  border: 1px solid ${COLORS.BORDER_LIGHT};
  color: ${COLORS.TEXT_PRIMARY};
`
