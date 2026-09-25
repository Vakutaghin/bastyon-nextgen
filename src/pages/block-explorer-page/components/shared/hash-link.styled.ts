import styled from 'vue3-styled-components'
import { TRANSITIONS } from '@/styles/design-tokens'

/** Полный хеш (64 символа) на телефоне шире карточки — поэтому переносится
 * в любом месте, а не вылезает за край. */
export const SC_HashLink = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-width: 0;
  font-family: var(--font-family-mono);
  font-size: 13px;
`

export const SC_HashLinkAnchor = styled.a`
  min-width: 0;
  color: var(--color-link);
  text-decoration: none;
  cursor: pointer;
  overflow-wrap: anywhere;

  &:hover {
    color: var(--color-primary-hover);
    text-decoration: underline;
  }
`

export const SC_HashLinkText = styled.span`
  min-width: 0;
  color: var(--color-text-primary);
  overflow-wrap: anywhere;
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
