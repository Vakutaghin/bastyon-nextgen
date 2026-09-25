import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_ReportBugWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 6px;
  border-radius: var(--ui-radius-md);
  transition: background-color 0.2s;
  color: ${COLORS.TEXT_PRIMARY};

  &:hover {
    background-color: var(--ui-bg-elevated);
  }
`
