import styled from 'vue3-styled-components'

import { COLORS } from '@/styles/theme-colors'

export const SC_BlockImage = styled.figure`
  margin: 1em 0;
  text-align: center;
`

export const SC_BlockImageImg = styled.img`
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  display: block;
  margin: 0 auto;
`

export const SC_BlockImageCaption = styled.figcaption`
  margin-top: 0.5em;
  font-size: 0.9em;
  color: ${COLORS.TEXT_SECONDARY};
  font-style: italic;
`
