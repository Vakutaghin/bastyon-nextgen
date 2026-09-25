import styled from 'vue3-styled-components'

import { BORDER_RADIUS, FONT_SIZE, SPACING } from '@/styles/design-tokens'

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

export const SC_Select = styled.select`
  padding: ${SPACING.XS} ${SPACING.SM};
  font-size: ${FONT_SIZE.MD};
  color: var(--color-text-primary);
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: ${BORDER_RADIUS.MD};
  outline: none;
  cursor: pointer;

  &:focus {
    border-color: var(--color-primary);
  }

  &:disabled {
    cursor: not-allowed;
    color: var(--color-text-muted);
  }
`

export const SC_DateInput = styled.input`
  padding: ${SPACING.XS} ${SPACING.SM};
  font-size: ${FONT_SIZE.MD};
  color: var(--color-text-primary);
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: ${BORDER_RADIUS.MD};
  outline: none;

  &:focus {
    border-color: var(--color-primary);
  }
`

export const SC_TrialHint = styled.span`
  font-size: ${FONT_SIZE.XS};
  color: var(--color-text-muted);
`
