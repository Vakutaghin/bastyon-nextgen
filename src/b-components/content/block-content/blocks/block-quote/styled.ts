import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_BlockQuote = styled.blockquote`
  margin: 1em 0;
  padding: 1em 1.5em;
  border-left: 4px solid ${COLORS.PRIMARY};
  background-color: rgba(248, 249, 250, 0.8);
  font-style: italic;
  color: ${COLORS.TEXT_PRIMARY} !important;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
`

export const SC_BlockQuoteContent = styled.div`
  line-height: 1.6;
  margin-bottom: 0.5em;
  color: ${COLORS.TEXT_PRIMARY} !important;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;

  :deep(*) {
    color: ${COLORS.TEXT_PRIMARY} !important;
  }

  :deep(.bastyon-link) {
    color: ${COLORS.PRIMARY} !important;
    text-decoration: underline;
    cursor: pointer;
    word-break: break-all;
    overflow-wrap: break-word;
    word-wrap: break-word;
  }

  :deep(.bastyon-link:hover) {
    color: ${COLORS.PRIMARY_ACTIVE} !important;
    text-decoration: underline;
  }
`

export const SC_BlockQuoteCaption = styled.footer`
  font-size: 0.9em;
  text-align: right;
  color: ${COLORS.TEXT_SECONDARY} !important;
  font-style: normal;
`
