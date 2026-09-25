import styled from 'vue3-styled-components'

import { BORDER_RADIUS, FONT_SIZE, SPACING } from '@/styles/design-tokens'

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
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;

  & input {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: var(--color-primary);
  }
`

export const SC_PollBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.XS};
  padding: ${SPACING.SM} ${SPACING.MD};
  border: 1px solid var(--color-border);
  border-radius: ${BORDER_RADIUS.MD};
  background: var(--color-bg-input);
`

export const SC_PollInput = styled.input`
  width: 100%;
  padding: ${SPACING.XS} ${SPACING.SM};
  font-size: ${FONT_SIZE.MD};
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: ${BORDER_RADIUS.SM};
  outline: none;

  &:focus {
    border-color: var(--color-primary);
  }

  &::placeholder {
    color: var(--color-text-muted);
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
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: ${FONT_SIZE.LG};
  line-height: 1;

  &:hover {
    color: var(--color-danger);
  }
`

export const SC_PollAddBtn = styled.button`
  align-self: flex-start;
  padding: ${SPACING.XS} ${SPACING.SM};
  border: none;
  background: none;
  color: var(--ui-primary-text);
  cursor: pointer;
  font-size: ${FONT_SIZE.SM};
  font-weight: 500;

  &:hover:not(:disabled) {
    color: var(--ui-primary);
  }

  &:disabled {
    color: var(--color-text-muted);
    cursor: not-allowed;
  }
`
