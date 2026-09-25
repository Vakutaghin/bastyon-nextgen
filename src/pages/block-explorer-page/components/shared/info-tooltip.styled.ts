import styled from 'vue3-styled-components'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_InfoTooltipIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  margin-left: 4px;
  font-size: 9px;
  font-weight: 700;
  color: var(--color-text-muted);
  background: var(--color-overlay-5);
  border: 1px solid var(--color-border-lighter);
  border-radius: 50%;
  cursor: help;
  user-select: none;
  vertical-align: middle;
  transition:
    color ${TRANSITIONS.QUICK},
    background-color ${TRANSITIONS.QUICK};

  &:hover {
    color: var(--color-primary);
    background: var(--color-primary-light);
    border-color: var(--color-primary-light-30);
  }
`
