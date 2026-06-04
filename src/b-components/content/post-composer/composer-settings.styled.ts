import styled from 'vue3-styled-components'

import { BORDER_RADIUS, FONT_SIZE, SPACING } from '@/styles/design-tokens'
import { COLORS } from '@/styles/theme-colors'

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
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_Select = styled.select`
  padding: ${SPACING.XS} ${SPACING.SM};
  font-size: ${FONT_SIZE.MD};
  color: ${COLORS.TEXT_PRIMARY};
  background: ${COLORS.BG_INPUT};
  border: 1px solid ${COLORS.BORDER};
  border-radius: ${BORDER_RADIUS.MD};
  outline: none;
  cursor: pointer;

  &:focus {
    border-color: ${COLORS.PRIMARY};
  }

  &:disabled {
    cursor: not-allowed;
    color: ${COLORS.TEXT_MUTED};
  }
`

export const SC_DateInput = styled.input`
  padding: ${SPACING.XS} ${SPACING.SM};
  font-size: ${FONT_SIZE.MD};
  color: ${COLORS.TEXT_PRIMARY};
  background: ${COLORS.BG_INPUT};
  border: 1px solid ${COLORS.BORDER};
  border-radius: ${BORDER_RADIUS.MD};
  outline: none;

  &:focus {
    border-color: ${COLORS.PRIMARY};
  }
`

export const SC_TrialHint = styled.span`
  font-size: ${FONT_SIZE.XS};
  color: ${COLORS.TEXT_MUTED};
`
