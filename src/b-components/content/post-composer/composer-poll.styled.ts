import styled from 'vue3-styled-components'

import { FONT_SIZE, SPACING } from '@/styles/design-tokens'
import { nuxtField } from '@/styles/field-styles'

export const SC_Poll = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.SM};
`

/** Шапка опроса: значок, «Опрос» и крестик «Убрать опрос». */
export const SC_PollHead = styled.div`
  display: flex;
  align-items: center;
  gap: ${SPACING.XS};
  font-size: ${FONT_SIZE.SM};
  font-weight: 500;
  color: var(--color-text-secondary);

  & > span {
    flex: 1;
  }
`

export const SC_PollBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.XS};
  padding: ${SPACING.SM} ${SPACING.MD};
  border: 1px solid var(--color-border);
  border-radius: var(--ui-radius-lg);
  background: var(--color-bg-input);
`

export const SC_PollInput = styled.input`
  ${nuxtField}
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

  &:hover:not(:disabled) {
    color: var(--color-danger);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
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
