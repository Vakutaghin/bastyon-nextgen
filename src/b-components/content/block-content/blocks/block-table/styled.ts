import styled from 'vue3-styled-components'

export const SC_BlockTableWrapper = styled.div`
  margin: 1em 0;
  overflow-x: auto;
`

export const SC_BlockTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  border: 1px solid var(--color-gray-ddd);
`

export const SC_BlockTableHeaderCell = styled.th`
  padding: 0.75em;
  background-color: var(--color-overlay-10);
  font-weight: 600;
  text-align: left;
  border: 1px solid var(--color-border-light);
  color: var(--color-text-primary);
`

export const SC_BlockTableCell = styled.td`
  padding: 0.75em;
  border: 1px solid var(--color-border-light);
  color: var(--color-text-primary);
`
