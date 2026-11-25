import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

// Поле выбора как было у antd в нашей теме (USelect Nuxt, вариант outline):
// высота 36 (large) или 32 (middle), поля 11px, текст 14/22, рамка
// border-accented, радиус 6, фон страницы, шеврон 20px dimmed в 11px от
// правого края. Наведение рамку не меняет, в фокусе — акцентная рамка и ореол
// 3px, как у полей ввода (components/input).
//
// Части для styled родителя: .ui-select, __trigger, __value, __placeholder,
// __arrow; список — отдельно (SC_SelectPanel), он рисуется в слое.
export const SC_Select = styled.div`
  position: relative;
  width: 100%;
  min-width: 0;

  .ui-select__trigger {
    position: relative;
    display: flex;
    align-items: center;
    box-sizing: border-box;
    width: 100%;
    height: 36px;
    margin: 0;
    padding: 0 11px;
    font: inherit;
    font-size: 14px;
    line-height: 22px;
    color: var(--ui-text);
    text-align: start;
    background: var(--ui-bg);
    border: 1px solid var(--ui-border-accented);
    border-radius: var(--ui-radius-md);
    outline: 0;
    cursor: pointer;
    transition:
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);
    appearance: none;
  }

  &[data-size='middle'] .ui-select__trigger {
    height: 32px;
  }

  .ui-select__trigger:focus,
  &[data-state='open'] .ui-select__trigger {
    border-color: var(--ui-primary);
    box-shadow: 0 0 0 3px rgb(var(--ui-primary-rgb) / 25%);
  }

  /* Значение и подсказка — одной строкой с многоточием; справа место под шеврон. */
  .ui-select__value,
  .ui-select__placeholder {
    flex: 1 1 auto;
    min-width: 0;
    padding-inline-end: 26px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .ui-select__placeholder {
    color: var(--ui-text-dimmed);
  }

  .ui-select__arrow {
    position: absolute;
    top: 50%;
    right: 10px;
    width: 20px;
    height: 20px;
    margin-top: -10px;
    font-size: 20px;
    color: var(--ui-text-dimmed);
    pointer-events: none;
  }

  &[data-disabled] .ui-select__trigger {
    color: var(--ui-text-highlighted);
    opacity: 0.75;
    cursor: not-allowed;
  }

  /* На телефоне 16px, как у полей ввода (field-styles.ts): поля рядом одного кегля. */
  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    &[data-size='large'] .ui-select__trigger {
      font-size: 16px;
    }
  }
`

// Список: карточка с кольцом и тенью, поля 4, высота до 256px; пункты 32px,
// текст в 12px от края (как значение в поле), подсвеченный — полупрозрачный
// elevated, выбранный — elevated с галочкой 16px цвета primary.
//
// Части: .ui-select-panel, .ui-select__list, __option (aria-selected,
// aria-disabled, data-active), __label, __check, __empty.
export const SC_SelectPanel = styled.div`
  box-sizing: border-box;
  max-width: var(--ui-floating-available-width, calc(100vw - 16px));
  padding: 4px;
  font-size: 14px;
  line-height: 22px;
  color: var(--ui-text);
  /* Список рисуется в корне слоя (окна), где может быть text-align: center. */
  text-align: start;
  background: var(--ui-bg);
  border-radius: var(--ui-radius-md);
  box-shadow:
    0 0 0 1px var(--ui-border),
    var(--ui-shadow-lg);

  .ui-select__list {
    max-height: min(256px, calc(var(--ui-floating-available-height, 264px) - 8px));
    margin: 0;
    padding: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    list-style: none;
  }

  .ui-select__option {
    display: flex;
    align-items: center;
    gap: 8px;
    box-sizing: border-box;
    min-height: 32px;
    margin: 0;
    padding: 5px 8px;
    border-radius: var(--ui-radius-md);
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .ui-select__label {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .ui-select__option[data-active] {
    color: var(--ui-text-highlighted);
    background: rgb(var(--ui-bg-elevated-rgb) / 50%);
  }

  .ui-select__option[aria-selected='true'] {
    color: var(--ui-text-highlighted);
    background: var(--ui-bg-elevated);
  }

  .ui-select__option[aria-disabled='true'] {
    color: var(--ui-text-dimmed);
    background: none;
    cursor: not-allowed;
  }

  .ui-select__check {
    flex: none;
    font-size: 16px;
    color: var(--ui-primary);
  }

  .ui-select__empty {
    padding: 5px 8px;
    color: var(--ui-text-dimmed);
  }
`
