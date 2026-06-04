import styled from 'vue3-styled-components'

import { BORDER_RADIUS, FONT_SIZE, SPACING } from '@/styles/design-tokens'
import { COLORS } from '@/styles/theme-colors'

export const SC_Poll = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.SM};
`

export const SC_PollToggle = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${SPACING.SM};
  align-self: flex-start;
  font-size: ${FONT_SIZE.MD};
  color: ${COLORS.TEXT_SECONDARY};
  cursor: pointer;
  user-select: none;

  & input {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: ${COLORS.PRIMARY};
  }
`

export const SC_PollBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.XS};
  padding: ${SPACING.SM} ${SPACING.MD};
  border: 1px solid ${COLORS.BORDER};
  border-radius: ${BORDER_RADIUS.MD};
  background: ${COLORS.BG_INPUT};
`

export const SC_PollInput = styled.input`
  width: 100%;
  padding: ${SPACING.XS} ${SPACING.SM};
  font-size: ${FONT_SIZE.MD};
  color: ${COLORS.TEXT_PRIMARY};
  background: ${COLORS.BG_PRIMARY};
  border: 1px solid ${COLORS.BORDER};
  border-radius: ${BORDER_RADIUS.SM};
  outline: none;

  &:focus {
    border-color: ${COLORS.PRIMARY};
  }

  &::placeholder {
    color: ${COLORS.TEXT_MUTED};
  }
`

export const SC_PollOptionRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${SPACING.XS};
`

export const SC_PollOptionRemove = styled.button`
  display: inline-flex;
  padding: 0 ${SPACING.XS};
  border: none;
  background: none;
  color: ${COLORS.TEXT_MUTED};
  cursor: pointer;
  font-size: ${FONT_SIZE.LG};
  line-height: 1;

  &:hover {
    color: ${COLORS.DANGER};
  }
`

export const SC_PollAddBtn = styled.button`
  align-self: flex-start;
  padding: ${SPACING.XS} ${SPACING.SM};
  border: none;
  background: none;
  color: ${COLORS.PRIMARY};
  cursor: pointer;
  font-size: ${FONT_SIZE.SM};

  &:disabled {
    color: ${COLORS.TEXT_MUTED};
    cursor: not-allowed;
  }
`
