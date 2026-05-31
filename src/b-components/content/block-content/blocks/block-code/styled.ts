import styled from 'vue3-styled-components'

import { COLORS } from '@/styles/theme-colors'

export const SC_BlockCode = styled.pre`
  margin: 1em 0;
  padding: 1em;
  background-color: ${COLORS.DARK_BG};
  border-radius: 4px;
  overflow-x: auto;
  border: 1px solid ${COLORS.TEXT_SECONDARY};
`

export const SC_BlockCodeCode = styled.code`
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.9em;
  line-height: 1.5;
  color: ${COLORS.WHITE};
  white-space: pre;
  word-wrap: normal;
  overflow-wrap: normal;
`
