import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_BlockHeader = styled.h1<{ level?: number }>`
  margin: 1.5em 0 0.5em;
  font-weight: 600;
  line-height: 1.3;
  color: ${COLORS.TEXT_PRIMARY} !important;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;

  &:first-child {
    margin-top: 0;
  }

  ${(p) => {
    const level = p.level || 1
    const sizes: Record<number, string> = {
      1: '2em',
      2: '1.75em',
      3: '1.5em',
      4: '1.25em',
      5: '1.1em',
      6: '1em',
    }
    return `font-size: ${sizes[level] || sizes[1]};`
  }}

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
