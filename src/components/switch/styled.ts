import styled from 'vue3-styled-components'

// Переключатель как был у antd в нашей теме: 40×20, бегунок 16, выключенный —
// bg-accented (наведение — border-accented), включённый — акцент. Маленький —
// 28×16, бегунок 12. Неактивный и «сохраняется» — прозрачность 0.65.
//
// Части для styled родителя: .ui-switch, .ui-switch__thumb; состояние —
// data-state="on|off", data-size. Переменные: --ui-switch-on, --ui-switch-off.
export const SC_Switch = styled.button`
  --ui-switch-w: 40px;
  --ui-switch-h: 20px;
  --ui-switch-pad: 2px;

  position: relative;
  display: inline-block;
  flex: 0 0 auto;
  box-sizing: border-box;
  width: var(--ui-switch-w);
  min-width: var(--ui-switch-w);
  height: var(--ui-switch-h);
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: var(--ui-radius-full);
  background: var(--ui-switch-off, var(--ui-bg-accented));
  vertical-align: middle;
  cursor: pointer;
  transition: background-color var(--transition-fast);

  &[data-size='small'] {
    --ui-switch-w: 28px;
    --ui-switch-h: 16px;
  }

  &:hover:not(:disabled) {
    background: var(--ui-border-accented);
  }

  &[data-state='on'] {
    background: var(--ui-switch-on, var(--ui-primary));
  }

  &[data-state='on']:hover:not(:disabled) {
    background: rgb(var(--ui-primary-rgb) / 75%);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }

  &:focus {
    outline: 0;
  }

  &:focus-visible {
    outline: var(--ui-focus-outline);
    outline-offset: 1px;
  }

  .ui-switch__thumb {
    position: absolute;
    top: var(--ui-switch-pad);
    left: var(--ui-switch-pad);
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(var(--ui-switch-h) - 2 * var(--ui-switch-pad));
    height: calc(var(--ui-switch-h) - 2 * var(--ui-switch-pad));
    border-radius: var(--ui-radius-full);
    background: var(--color-white);
    box-shadow: var(--ui-shadow-md);
    transition: left var(--transition-fast);
  }

  &[data-state='on'] .ui-switch__thumb {
    left: calc(100% - var(--ui-switch-h) + var(--ui-switch-pad));
  }

  .ui-switch__spinner {
    color: var(--ui-text-dimmed);
    font-size: calc(var(--ui-switch-h) - 2 * var(--ui-switch-pad) - 4px);
  }

  &[data-state='on'] .ui-switch__spinner {
    color: var(--ui-primary);
  }

  @media (prefers-reduced-motion: reduce) {
    &,
    .ui-switch__thumb {
      transition: none;
    }
  }
`
