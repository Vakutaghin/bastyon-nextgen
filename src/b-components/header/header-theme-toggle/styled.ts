import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_ThemeToggleWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 6px;
  border-radius: var(--ui-radius-md);
  transition: background-color ${TRANSITIONS.FAST};
  color: ${COLORS.TEXT_PRIMARY};

  &:hover {
    background-color: var(--ui-bg-elevated);
  }
`
