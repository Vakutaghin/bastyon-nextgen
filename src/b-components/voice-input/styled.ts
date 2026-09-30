import styled from 'vue3-styled-components'

/**
 * Кнопка голосового ввода. Громкость приходит ~20 раз в секунду: она пишется
 * в CSS-переменную --level на самой кнопке (voice-input-button.vue), а не в
 * props — иначе каждое значение порождало бы новый CSS-класс.
 */
export const SC_DictationButton = styled.button`
  --level: 0;
  position: relative;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background-color: transparent;
  color: var(--ui-text-dimmed);
  font-size: 18px;
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background-color var(--transition-fast);

  &:hover:not(:disabled) {
    color: var(--ui-text-highlighted);
    background-color: var(--ui-bg-elevated);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 1px;
  }

  &.active {
    color: var(--color-danger);
    background-color: var(--color-danger-bg-soft);
  }

  &.active:hover {
    background-color: rgb(var(--ui-error-rgb) / 16%);
  }

  &.speaking {
    background-color: rgb(var(--ui-error-rgb) / 18%);
  }
`

export const SC_Bars = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 16px;

  &.loading {
    opacity: 0.55;
  }
`

export const SC_Bar = styled.span`
  width: 3px;
  height: 16px;
  border-radius: var(--ui-radius-xs);
  background-color: currentColor;
  transform-origin: center;
  transition: transform var(--transition-fast);

  &:nth-child(1) {
    transform: scaleY(calc(0.2 + var(--level) * 0.45));
  }

  &:nth-child(2) {
    transform: scaleY(calc(0.25 + var(--level) * 0.75));
  }

  &:nth-child(3) {
    transform: scaleY(calc(0.25 + var(--level) * 0.9));
  }

  &:nth-child(4) {
    transform: scaleY(calc(0.2 + var(--level) * 0.55));
  }
`
