import styled from 'vue3-styled-components'

import { FONT_SIZE, SPACING } from '@/styles/design-tokens'

/** Кнопка выбора файла: label вокруг скрытого input[type=file]. */
export const SC_VideoPick = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${() => SPACING.SM};
  align-self: flex-start;
  font-size: ${() => FONT_SIZE.MD};
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;

  &:hover {
    color: var(--ui-primary);
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

export const SC_VideoPanel = styled.div`
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

/** Та же панель в состоянии ошибки. */
export const SC_VideoErrorPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${() => SPACING.SM};
  padding: ${() => SPACING.SM} ${() => SPACING.MD};
  font-size: ${() => FONT_SIZE.MD};
  color: var(--ui-error);
  background: var(--color-bg-secondary);
  border: 1px solid var(--ui-error);
  border-radius: var(--ui-radius-lg);
`

export const SC_VideoRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${() => SPACING.SM};
  min-width: 0;
`

export const SC_VideoName = styled.span`
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ui-text-highlighted);
`

export const SC_VideoHint = styled.span`
  font-size: ${() => FONT_SIZE.SM};
  color: var(--ui-text-muted);
`

export const SC_Progress = styled.progress`
  width: 100%;
  height: 6px;
  overflow: hidden;
  appearance: none;
  border: 0;
  border-radius: var(--ui-radius-full);
  background: var(--ui-bg-accented);
  accent-color: var(--ui-primary);

  &::-webkit-progress-bar {
    background: var(--ui-bg-accented);
    border-radius: var(--ui-radius-full);
  }

  &::-webkit-progress-value {
    background: var(--ui-primary);
    border-radius: var(--ui-radius-full);
    transition: width var(--transition-fast);
  }

  &::-moz-progress-bar {
    background: var(--ui-primary);
    border-radius: var(--ui-radius-full);
  }
`

export const SC_VideoAction = styled.button`
  flex-shrink: 0;
  padding: 0;
  font-size: ${() => FONT_SIZE.MD};
  color: var(--ui-primary);
  background: none;
  border: 0;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
    outline-offset: 2px;
  }
`
