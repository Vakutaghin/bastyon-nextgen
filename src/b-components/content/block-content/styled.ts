import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_BlockContent = styled.div`
  width: 100%;
  color: ${COLORS.TEXT_PRIMARY} !important;

  > * {
    margin-bottom: 1em;
    color: ${COLORS.TEXT_PRIMARY} !important;
  }

  > *:last-child {
    margin-bottom: 0;
  }

  * {
    color: ${COLORS.TEXT_PRIMARY} !important;
  }

  p {
    color: ${COLORS.TEXT_PRIMARY} !important;
  }

  div {
    color: ${COLORS.TEXT_PRIMARY} !important;
  }

  span {
    color: ${COLORS.TEXT_PRIMARY} !important;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    color: ${COLORS.TEXT_PRIMARY} !important;
  }
`
