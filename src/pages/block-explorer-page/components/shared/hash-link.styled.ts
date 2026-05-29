import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_HashLink = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
`

export const SC_HashLinkAnchor = styled.a`
  color: ${COLORS.LINK};
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    color: ${COLORS.PRIMARY_HOVER};
    text-decoration: underline;
  }
`

export const SC_HashLinkText = styled.span`
  color: ${COLORS.TEXT_PRIMARY};
  white-space: nowrap;
`

export const SC_HashLinkCopy = styled.button`
  background: transparent;
  border: none;
  padding: 0 2px;
  color: ${COLORS.TEXT_MUTED};
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  transition: color ${TRANSITIONS.QUICK};

  &:hover {
    color: ${COLORS.PRIMARY};
  }
`
