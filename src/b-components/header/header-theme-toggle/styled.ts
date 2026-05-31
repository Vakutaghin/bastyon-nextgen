import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_ThemeToggleWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: background-color ${TRANSITIONS.FAST};
  color: ${COLORS.TEXT_PRIMARY};

  &:hover {
    background-color: ${COLORS.OVERLAY_4};
  }
`
