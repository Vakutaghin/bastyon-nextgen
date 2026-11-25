import styled from 'vue3-styled-components'

import { FONT_SIZE, SPACING } from '@/styles/design-tokens'

export const SC_Audios = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${() => SPACING.SM};
  padding: ${() => SPACING.SM} ${() => SPACING.MD};
  font-size: ${() => FONT_SIZE.MD};
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--ui-radius-lg);
`

export const SC_List = styled.ol`
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const SC_Item = styled.li`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 2px 0;
  border-radius: var(--ui-radius-md);

  &.dragging {
    background: var(--ui-bg-muted);
  }
`

export const SC_Row = styled.div`
  display: flex;
  align-items: center;
  gap: ${() => SPACING.SM};
  min-width: 0;
  min-height: 32px;
`

const ICON_BUTTON = `
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: var(--ui-radius-sm);
  background: none;
  color: var(--ui-text-muted);
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--ui-bg-accented);
    color: var(--ui-text);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  &:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
    outline-offset: -2px;
  }
`

export const SC_Handle = styled.button`
  ${() => ICON_BUTTON}
  margin-left: -8px;
  cursor: grab;
  touch-action: none;
`

export const SC_Remove = styled.button`
  ${() => ICON_BUTTON}
  margin-right: -6px;
`

export const SC_Number = styled.span`
  flex: none;
  min-width: 2ch;
  color: var(--ui-text-muted);
  font-size: ${() => FONT_SIZE.SM};
  font-variant-numeric: tabular-nums;
  text-align: right;
`

export const SC_TitleInput = styled.input`
  flex: 1 1 auto;
  min-width: 0;
  padding: 4px 6px;
  border: 1px solid transparent;
  border-radius: var(--ui-radius-sm);
  background: none;
  color: var(--ui-text-highlighted);
  font: inherit;

  &:hover:not(:disabled) {
    border-color: var(--ui-border);
  }

  &:focus {
    border-color: var(--ui-primary);
    outline: none;
  }

  &::placeholder {
    color: var(--ui-text-dimmed);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.75;
  }
`

export const SC_Name = styled.span`
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ui-text-highlighted);
`

/** Подпись обложки: на узком экране — в две строки, а не «Обло…». */
export const SC_CoverName = styled.span`
  flex: 1 1 auto;
  min-width: 0;
  color: var(--ui-text-highlighted);
`

export const SC_Status = styled.span`
  flex: none;
  color: var(--ui-text-muted);
  font-size: ${() => FONT_SIZE.SM};
  font-variant-numeric: tabular-nums;
`

export const SC_Error = styled.span`
  color: var(--ui-error);
  font-size: ${() => FONT_SIZE.SM};
`

export const SC_Foot = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${() => SPACING.SM} ${() => SPACING.MD};
`

/** «Добавить запись»: label вокруг скрытого input[type=file]. */
export const SC_Add = styled.label`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ui-primary);
  cursor: pointer;

  &:hover:not(.disabled) {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  &.disabled {
    color: var(--ui-text-dimmed);
    cursor: not-allowed;
  }

  &:focus-within {
    outline: 2px solid var(--ui-focus-outline);
    outline-offset: 2px;
    border-radius: var(--ui-radius-sm);
  }

  & input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }
`

export const SC_Action = styled.button`
  flex: none;
  padding: 0;
  border: 0;
  background: none;
  color: var(--ui-primary);
  font: inherit;
  cursor: pointer;

  &:hover:not(:disabled) {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  &:disabled {
    color: var(--ui-text-dimmed);
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
    outline-offset: 2px;
  }
`

export const SC_Hint = styled.span`
  color: var(--ui-text-muted);
  font-size: ${() => FONT_SIZE.SM};
`
