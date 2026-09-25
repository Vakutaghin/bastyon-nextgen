import styled from 'vue3-styled-components'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_ShareBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  color: var(--ui-text);
  background: var(--ui-bg);
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  transition:
    background-color ${TRANSITIONS.QUICK},
    border-color ${TRANSITIONS.QUICK},
    color ${TRANSITIONS.QUICK};

  &:hover {
    color: var(--ui-text);
    background: var(--ui-bg-elevated);
  }
`
