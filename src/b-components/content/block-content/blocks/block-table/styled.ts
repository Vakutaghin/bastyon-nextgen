import styled from 'vue3-styled-components'

export const SC_BlockTableWrapper = styled.div`
  margin: 1em 0;
  overflow-x: auto;
`

export const SC_BlockTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  border: 1px solid var(--border-color, #ddd);
`

export const SC_BlockTableHeaderCell = styled.th`
  padding: 0.75em;
  background-color: rgba(var(--color-txt-gray, 100, 100, 100), 0.1);
  font-weight: 600;
  text-align: left;
  border: 1px solid rgba(var(--color-txt-gray, 100, 100, 100), 0.2);
  color: rgb(var(--text-color, 255, 255, 255));
`

export const SC_BlockTableCell = styled.td`
  padding: 0.75em;
  border: 1px solid rgba(var(--color-txt-gray, 100, 100, 100), 0.2);
  color: rgb(var(--text-color, 255, 255, 255));
`
