import styled from 'vue3-styled-components'

// Флажок как был у antd в нашей теме: квадрат 16px, радиус 4, рамка
// border-accented (наведение — акцент), отмеченный — заливка акцентом и белая
// галочка; подпись 14px через 8px. Настоящий input лежит прозрачным поверх
// квадрата: фокус, Пробел и диктор — его.
//
// Части для styled родителя: .ui-checkbox, __control, __input, __box, __label.
export const SC_Checkbox = styled.label`
  display: inline-flex;
  align-items: baseline;
  color: var(--ui-text);
  font-size: 14px;
  line-height: 22px;
  cursor: pointer;

  &[data-disabled] {
    cursor: not-allowed;
  }

  .ui-checkbox__control {
    position: relative;
    top: 0.2em;
    flex: 0 0 auto;
    width: 16px;
    height: 16px;
    line-height: 1;
    white-space: nowrap;
  }

  .ui-checkbox__input {
    position: absolute;
    inset: 0;
    z-index: 1;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: inherit;
  }

  .ui-checkbox__box {
    position: relative;
    display: block;
    box-sizing: border-box;
    width: 16px;
    height: 16px;
    border: 1px solid var(--ui-border-accented);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-bg);
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast);
  }

  /* Галочка — повёрнутый уголок рамки, как у antd. */
  .ui-checkbox__box::after {
    position: absolute;
    top: 50%;
    left: 21.5%;
    display: table;
    box-sizing: border-box;
    width: 5.7142px;
    height: 9.1428px;
    border: 2px solid var(--ui-text-inverted);
    border-top: 0;
    border-left: 0;
    opacity: 0;
    transform: rotate(45deg) scale(0) translate(-50%, -50%);
    transition:
      transform var(--transition-quick),
      opacity var(--transition-quick);
    content: '';
  }

  &:not([data-disabled]):hover .ui-checkbox__box {
    border-color: var(--ui-primary);
  }

  .ui-checkbox__input:checked + .ui-checkbox__box {
    border-color: var(--ui-primary);
    background: var(--ui-primary);
  }

  .ui-checkbox__input:checked + .ui-checkbox__box::after {
    opacity: 1;
    transform: rotate(45deg) scale(1) translate(-50%, -50%);
    transition: transform var(--transition-fast);
  }

  .ui-checkbox__input:focus-visible + .ui-checkbox__box {
    outline: var(--ui-focus-outline);
    outline-offset: 2px;
  }

  .ui-checkbox__input:disabled + .ui-checkbox__box {
    border-color: var(--ui-border-accented);
    background: var(--ui-bg-elevated);
  }

  .ui-checkbox__input:disabled + .ui-checkbox__box::after {
    border-color: var(--ui-text-dimmed);
  }

  .ui-checkbox__label {
    padding: 0 8px;
  }

  &[data-disabled] .ui-checkbox__label {
    color: var(--ui-text-dimmed);
  }

  @media (prefers-reduced-motion: reduce) {
    .ui-checkbox__box,
    .ui-checkbox__box::after,
    .ui-checkbox__input:checked + .ui-checkbox__box::after {
      transition: none;
    }
  }
`
