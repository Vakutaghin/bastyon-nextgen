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

  :deep(*) {
    color: ${COLORS.TEXT_PRIMARY} !important;
  }

  :deep(p) {
    color: ${COLORS.TEXT_PRIMARY} !important;
  }

  :deep(div) {
    color: ${COLORS.TEXT_PRIMARY} !important;
  }

  :deep(span) {
    color: ${COLORS.TEXT_PRIMARY} !important;
  }

  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    color: ${COLORS.TEXT_PRIMARY} !important;
  }
`
