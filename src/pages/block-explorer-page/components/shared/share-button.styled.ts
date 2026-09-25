import styled from 'vue3-styled-components'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_ShareBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-lighter);
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  transition:
    background-color ${TRANSITIONS.QUICK},
    border-color ${TRANSITIONS.QUICK},
    color ${TRANSITIONS.QUICK};

  &:hover {
    color: var(--color-primary);
    background: var(--color-primary-light);
    border-color: var(--color-primary-light-30);
  }
`
