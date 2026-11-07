import styled from 'vue3-styled-components'
import { SPACING } from '@/styles/design-tokens'

export const SC_Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${() => SPACING.MD};
`

export const SC_Lead = styled.div`
  color: var(--ui-text-muted);
  font-size: 14px;
`
