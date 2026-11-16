import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

// Поле календаря как было у antd в нашей теме — как поля ввода и Select рядом:
// высота 36 (large) или 32 (middle), поля 11px, текст 14/22 highlighted, рамка
// border-accented, радиус 6, фон страницы; значок календаря справа 16px (у
// middle — 14px) dimmed, при наведении на его месте — крестик очистки. В фокусе
// — акцентная рамка и ореол 3px.
//
// Части для styled родителя: .ui-date-picker, __trigger, __value,
// __placeholder, __icon, __clear; панель — SC_DatePanel, она в слое.
export const SC_DatePicker = styled.div`
  position: relative;
  width: 100%;
  min-width: 0;

  .ui-date-picker__trigger {
    display: flex;
    align-items: center;
    gap: 4px;
    box-sizing: border-box;
    width: 100%;
    height: 36px;
    margin: 0;
    padding: 0 11px;
    font: inherit;
    font-size: 14px;
    line-height: 22px;
    color: var(--ui-text-highlighted);
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

  &[data-size='middle'] .ui-date-picker__trigger {
    height: 32px;
  }

  .ui-date-picker__trigger:focus,
  &[data-state='open'] .ui-date-picker__trigger {
    border-color: var(--ui-primary);
    box-shadow: 0 0 0 3px rgb(var(--ui-primary-rgb) / 25%);
  }

  .ui-date-picker__value,
  .ui-date-picker__placeholder {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .ui-date-picker__placeholder {
    color: var(--ui-text-dimmed);
  }

  .ui-date-picker__icon,
  .ui-date-picker__clear {
    flex: none;
    font-size: 16px;
    color: var(--ui-text-dimmed);
  }

  &[data-size='middle'] :is(.ui-date-picker__icon, .ui-date-picker__clear) {
    font-size: 14px;
  }

  /* Крестик — поверх значка, на его месте (12px от края: рамка и поле). */
  .ui-date-picker__clear {
    position: absolute;
    top: 50%;
    right: 12px;
    display: none;
    margin: 0;
    padding: 0;
    line-height: 0;
    background: var(--ui-bg);
    border: 0;
    cursor: pointer;
    transform: translateY(-50%);
  }

  .ui-date-picker__clear:hover {
    color: var(--ui-text-muted);
  }

  &[data-clearable]:hover .ui-date-picker__clear {
    display: inline-flex;
  }

  &[data-clearable]:hover .ui-date-picker__icon {
    visibility: hidden;
  }

  &[data-disabled] .ui-date-picker__trigger {
    opacity: 0.75;
    cursor: not-allowed;
  }

  /* На телефоне 16px, как у полей ввода (field-styles.ts). */
  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    &[data-size='large'] .ui-date-picker__trigger {
      font-size: 16px;
    }
  }
`

// Панель: карточка с кольцом и тенью. Календарь 322px: шапка 36 с чертой,
// сетка с полями 8/12, клетки 42×36 с днём 28×28 (радиус 4); сегодня — рамка
// primary, выбранный — заливка primary, соседние месяцы и недоступные дни —
// dimmed. Время — две колонки по 50px с клетками 28px, выбранная — elevated.
// Подвал: «ОК» справа или «Сегодня» по центру.
//
// Части: .ui-date-panel и её __* (см. date-time-picker.vue).
export const SC_DatePanel = styled.div`
  box-sizing: border-box;
  max-width: calc(100vw - 16px);
  overflow: hidden;
  font-size: 14px;
  line-height: 22px;
  color: var(--ui-text);
  /* Панель рисуется в корне слоя (окна), где может быть text-align: center. */
  text-align: start;
  background: var(--ui-bg);
  border-radius: var(--ui-radius-md);
  box-shadow:
    0 0 0 1px var(--ui-border),
    var(--ui-shadow-lg);

  /* Свои кнопки панели — без оформления браузера; «ОК» — наша Button, её не трогаем. */
  & :is(.ui-date-panel__nav, .ui-date-panel__day, .ui-date-panel__today) {
    margin: 0;
    font: inherit;
    color: inherit;
    background: none;
    border: 0;
    appearance: none;
  }

  .ui-date-panel__main {
    display: flex;
  }

  .ui-date-panel__calendar {
    flex: none;
    width: 322px;
  }

  .ui-date-panel__header,
  .ui-date-panel__time-header {
    box-sizing: border-box;
    height: 37px;
    border-bottom: 1px solid var(--ui-border);
  }

  .ui-date-panel__header {
    display: flex;
    align-items: center;
    padding: 0 8px;
    color: var(--ui-text-highlighted);
  }

  .ui-date-panel__nav {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 36px;
    padding: 0;
    font-size: 14px;
    color: var(--ui-text-dimmed);
    border-radius: var(--ui-radius-md);
    cursor: pointer;
    transition: color var(--transition-fast);
  }

  .ui-date-panel__nav:hover {
    color: var(--ui-text);
  }

  .ui-date-panel__title {
    flex: 1 1 auto;
    min-width: 0;
    font-weight: 600;
    line-height: 36px;
    text-align: center;
    white-space: nowrap;
  }

  .ui-date-panel__body {
    padding: 8px 12px;
  }

  .ui-date-panel__grid {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .ui-date-panel__weekday {
    height: 36px;
    padding: 0;
    font-weight: 400;
    color: var(--ui-text);
    text-align: center;
  }

  .ui-date-panel__cell {
    height: 36px;
    padding: 0;
    text-align: center;
  }

  .ui-date-panel__day {
    position: relative;
    display: inline-block;
    min-width: 28px;
    height: 28px;
    padding: 0;
    line-height: 28px;
    color: var(--ui-text);
    border-radius: var(--ui-radius-sm);
    outline: 0;
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .ui-date-panel__day[data-outside] {
    color: var(--ui-text-dimmed);
  }

  .ui-date-panel__day:hover {
    background: rgb(var(--ui-bg-elevated-rgb) / 50%);
  }

  .ui-date-panel__day[data-today]::before {
    position: absolute;
    inset: 0;
    border: 1px solid var(--ui-primary);
    border-radius: inherit;
    content: '';
  }

  .ui-date-panel__day[data-selected] {
    color: var(--ui-text-inverted);
    background: var(--ui-primary);
  }

  /* Недоступные дни — просто бледнее, как у UCalendar. */
  .ui-date-panel__day[aria-disabled='true'] {
    color: var(--ui-text-dimmed);
    background: none;
    cursor: not-allowed;
  }

  /* Фокус с клавиатуры. В Safari до 15.4 :focus-visible нет — правило с
     :not() там отбрасывается целиком, и кольцо видно по :focus. */
  .ui-date-panel__day:focus,
  .ui-date-panel__column:focus,
  .ui-date-panel__nav:focus,
  .ui-date-panel__today:focus {
    outline: 2px solid var(--ui-primary);
    outline-offset: -2px;
  }

  .ui-date-panel__day:focus:not(:focus-visible),
  .ui-date-panel__column:focus:not(:focus-visible),
  .ui-date-panel__nav:focus:not(:focus-visible),
  .ui-date-panel__today:focus:not(:focus-visible) {
    outline: 0;
  }

  .ui-date-panel__time {
    display: flex;
    flex: none;
    flex-direction: column;
    width: 102px;
    border-left: 1px solid var(--ui-border);
  }

  .ui-date-panel__columns {
    display: flex;
    height: 268px;
  }

  /* Колонка листается колесом, касанием и стрелками; полосы прокрутки нет,
     как у antd. Снизу запас, чтобы и последний час встал наверх. */
  .ui-date-panel__column {
    position: relative;
    flex: 1 1 0;
    min-width: 0;
    margin: 4px 0;
    padding: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    list-style: none;
    scrollbar-width: none;
  }

  .ui-date-panel__column::-webkit-scrollbar {
    display: none;
  }

  .ui-date-panel__column::after {
    display: block;
    height: calc(100% - 28px);
    content: '';
  }

  .ui-date-panel__column + .ui-date-panel__column {
    border-left: 1px solid var(--ui-border);
  }

  .ui-date-panel__time-cell {
    height: 28px;
    margin: 0 4px;
    padding-inline-start: 11px;
    line-height: 28px;
    color: var(--ui-text);
    border-radius: var(--ui-radius-sm);
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .ui-date-panel__time-cell:hover {
    background: rgb(var(--ui-bg-elevated-rgb) / 50%);
  }

  .ui-date-panel__time-cell[aria-selected='true'] {
    background: var(--ui-bg-elevated);
  }

  .ui-date-panel__time-cell[aria-disabled='true'] {
    color: var(--ui-text-dimmed);
    background: none;
    cursor: not-allowed;
  }

  .ui-date-panel__footer {
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    height: 35px;
    padding: 0 12px;
    border-top: 1px solid var(--ui-border);
  }

  &[data-time] .ui-date-panel__footer {
    justify-content: flex-end;
    height: 39px;
  }

  .ui-date-panel__today {
    padding: 0;
    line-height: 34px;
    color: var(--ui-primary);
    cursor: pointer;
  }

  .ui-date-panel__today:hover {
    opacity: 0.8;
  }

  .ui-date-panel__today:disabled {
    color: var(--ui-text-dimmed);
    opacity: 1;
    cursor: not-allowed;
  }

  /* Телефон: календарь с временем (424px) не влез бы в 390 — клетки уже, поля меньше. */
  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    &[data-time] .ui-date-panel__calendar {
      width: 268px;
    }

    &[data-time] .ui-date-panel__body {
      padding: 8px;
    }
  }
`
