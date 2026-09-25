import styled from 'vue3-styled-components'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_HashLink = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-family-mono);
  font-size: 13px;
`

export const SC_HashLinkAnchor = styled.a`
  color: var(--color-link);
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    color: var(--color-primary-hover);
    text-decoration: underline;
  }
`

export const SC_HashLinkText = styled.span`
  color: var(--color-text-primary);
  white-space: nowrap;
`

export const SC_HashLinkCopy = styled.button`
  background: transparent;
  border: none;
  padding: 0 2px;
  color: var(--color-text-muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  transition: color ${TRANSITIONS.QUICK};

  &:hover {
    color: var(--color-primary);
  }
`
