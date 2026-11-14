import styled from 'vue3-styled-components'

// Поле как было у antd в нашей теме: высота 32, поля 4/11, текст 14/22, рамка
// border-accented, радиус 6, фон страницы. Наведение рамку не меняет (как у
// Nuxt UInput), в фокусе — акцентная рамка и ореол 3px. Ошибка и предупреждение
// красят рамку и ореол своим цветом.
//
// Части для styled родителя: .ui-input, __prefix, __control, __suffix, __clear,
// __count. Переменные: --ui-input-radius (поиск срезает правые углы).
export const SC_Input = styled.span`
  --ui-input-ring: var(--ui-primary-rgb);

  position: relative;
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 4px 11px;
  font-size: 14px;
  line-height: 22px;
  color: var(--ui-text-highlighted);
  background: var(--ui-bg);
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--ui-input-radius, var(--ui-radius-md));
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);

  &:focus-within {
    border-color: rgb(var(--ui-input-ring));
    box-shadow: 0 0 0 3px rgb(var(--ui-input-ring) / 25%);
  }

  &[data-status='error'] {
    --ui-input-ring: var(--ui-error-rgb);

    border-color: var(--ui-error);
  }

  &[data-status='warning'] {
    --ui-input-ring: var(--ui-warning-rgb);

    border-color: var(--ui-warning);
  }

  &[data-disabled] {
    cursor: not-allowed;
    opacity: 0.75;
  }

  .ui-input__control {
    flex: 1 1 auto;
    width: 100%;
    min-width: 0;
    margin: 0;
    padding: 0;
    font: inherit;
    color: inherit;
    background: transparent;
    border: 0;
    border-radius: 0;
    outline: 0;
    box-shadow: none;
    /* Длинная подсказка в узком поле — с многоточием, как у antd. */
    text-overflow: ellipsis;
  }

  .ui-input__control::placeholder {
    color: var(--ui-text-dimmed);
  }

  .ui-input__control:disabled {
    cursor: not-allowed;
  }

  .ui-input__prefix,
  .ui-input__suffix {
    display: flex;
    flex: none;
    align-items: center;
  }

  .ui-input__prefix {
    margin-inline-end: 4px;
  }

  .ui-input__suffix {
    gap: 8px;
    margin-inline-start: 4px;
  }

  .ui-input__clear {
    display: inline-flex;
    align-items: center;
    margin: 0;
    padding: 0;
    font-size: 12px;
    color: var(--ui-text-dimmed);
    background: none;
    border: 0;
    cursor: pointer;
    transition: color var(--transition-fast);
  }

  .ui-input__clear:hover {
    color: var(--ui-text);
  }

  .ui-input__clear[data-hidden] {
    visibility: hidden;
  }

  .ui-input__count {
    color: var(--ui-text-muted);
    white-space: nowrap;
  }
`
