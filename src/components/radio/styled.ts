import styled from 'vue3-styled-components'

// Радиокнопка как была у antd в нашей теме: кружок 16px, рамка
// border-accented (наведение — акцент), выбранная — заливка акцентом и точка
// 6px; подпись 14px через 8px, справа отступ 8px. Настоящий input лежит
// прозрачным поверх.
//
// Части для styled родителя: .ui-radio, __control, __input, __circle, __label.
export const SC_Radio = styled.label`
  display: inline-flex;
  align-items: baseline;
  margin-inline-end: 8px;
  color: var(--ui-text);
  font-size: 14px;
  line-height: 22px;
  cursor: pointer;

  &[data-disabled] {
    cursor: not-allowed;
  }

  .ui-radio__control {
    position: relative;
    top: 0.2em;
    flex: 0 0 auto;
    width: 16px;
    height: 16px;
  }

  .ui-radio__input {
    position: absolute;
    inset: 0;
    z-index: 1;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: inherit;
  }

  .ui-radio__circle {
    position: relative;
    display: block;
    box-sizing: border-box;
    width: 16px;
    height: 16px;
    border: 1px solid var(--ui-border-accented);
    border-radius: var(--ui-radius-full);
    background: var(--ui-bg);
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast);
  }

  .ui-radio__circle::after {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 16px;
    height: 16px;
    margin: -8px 0 0 -8px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-text-inverted);
    opacity: 0;
    transform: scale(0);
    transition: all var(--transition-normal);
    content: '';
  }

  &:not([data-disabled]):hover .ui-radio__circle {
    border-color: var(--ui-primary);
  }

  .ui-radio__input:checked + .ui-radio__circle {
    border-color: var(--ui-primary);
    background: var(--ui-primary);
  }

  .ui-radio__input:checked + .ui-radio__circle::after {
    opacity: 1;
    transform: scale(0.375);
  }

  .ui-radio__input:focus-visible + .ui-radio__circle {
    outline: var(--ui-focus-outline);
    outline-offset: 2px;
  }

  .ui-radio__input:disabled + .ui-radio__circle {
    border-color: var(--ui-border-accented);
    background: var(--ui-bg-elevated);
  }

  .ui-radio__input:disabled + .ui-radio__circle::after {
    background: var(--ui-text-dimmed);
  }

  .ui-radio__label {
    padding: 0 8px;
  }

  &[data-disabled] .ui-radio__label {
    color: var(--ui-text-dimmed);
  }

  @media (prefers-reduced-motion: reduce) {
    .ui-radio__circle,
    .ui-radio__circle::after {
      transition: none;
    }
  }
`
