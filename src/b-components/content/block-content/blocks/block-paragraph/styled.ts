import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_BlockParagraph = styled.p`
  margin: 0.75em 0;
  line-height: 1.6;
  color: ${COLORS.TEXT_PRIMARY} !important;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;

  &:first-child {
    margin-top: 0;
  }

  &:last-child {
    margin-bottom: 0;
  }

  * {
    color: ${COLORS.TEXT_PRIMARY} !important;
  }

  .bastyon-link {
    color: ${COLORS.PRIMARY} !important;
    text-decoration: underline;
    cursor: pointer;
    word-break: break-all;
    overflow-wrap: break-word;
    word-wrap: break-word;
  }

  .bastyon-link:hover {
    color: ${COLORS.PRIMARY_ACTIVE} !important;
    text-decoration: underline;
  }
`
