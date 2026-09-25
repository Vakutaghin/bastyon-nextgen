import styled from 'vue3-styled-components'

import { FONT_SIZE, SPACING } from '@/styles/design-tokens'
import { nuxtField } from '@/styles/field-styles'

export const SC_Settings = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${SPACING.MD};
`

export const SC_SettingItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.XS};
  min-width: 160px;
  flex: 1;
`

export const SC_Label = styled.label`
  font-size: ${FONT_SIZE.SM};
  color: var(--color-text-secondary);
`

export const SC_DateInput = styled.input`
  ${nuxtField}
  width: auto;
`

export const SC_TrialHint = styled.span`
  font-size: ${FONT_SIZE.SM};
  color: var(--color-text-muted);
`
