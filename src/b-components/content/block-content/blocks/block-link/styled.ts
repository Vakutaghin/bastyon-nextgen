import styled from 'vue3-styled-components'

import { COLORS } from '@/styles/theme-colors'

export const SC_BlockLink = styled.a`
  color: ${COLORS.BRAND_CYAN};
  text-decoration: none;
  word-break: break-all;

  &:hover {
    text-decoration: underline;
  }
`
