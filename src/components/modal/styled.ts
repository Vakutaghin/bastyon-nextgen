import styled from 'vue3-styled-components'
import { SHELL } from '@/styles/design-tokens'

/**
 * Утилитарные layout-обёртки для тела модалок — заменяют распространённые
 * inline `style="..."` биндинги в confirm-*-modal.vue. См. CODE_AUDIT.md §3.1.
 */
/** Кнопочный ряд в футере модалки: справа, маленький gap. */
export const SC_ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

/** Строка с иконкой и текстом в шапке/блоке модалки. */
export const SC_ModalIconRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

/** Контейнер тела confirm-модалки с вертикальным паддингом. */
export const SC_ModalBody = styled.div`
  padding: 16px 0;
`

// Окно как было у antd Modal в нашей теме (wireframe: шапка и футер
// отделены линиями): ширина 520, 100px от верха или по центру, фон страницы,
// радиус 8, кольцо-рамка и тень оверлеев; маска — дымка bg-elevated/75.
// Слой (z-index) ставит стек на корень, ширину — окно на .ui-modal.
//
// Части для styled родителя и правил style.css: .ui-modal-root, -mask, -wrap
// (data-centered, класс wrapClass), .ui-modal (класс потребителя),
// __content, __close, __header, __title, __body, __footer. Переменные:
// --ui-modal-body-padding, --modal-body-max-height (style.css). Правила окон
// во весь экран в style.css начинаются с `.ui-modal-root .ui-modal-wrap >
// .ui-modal.<класс>`: сильнее этих (их положения — на :where).
// Корень — fixed нулевого размера в углу экрана: на нём слой, а панели antd
// внутри окна (список Select) считают положение от экрана, как в обёртке
// antd, и не уезжают в конец страницы.
export const SC_ModalRoot = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 0;
  height: 0;

  .ui-modal-mask {
    position: fixed;
    inset: 0;
    background: rgb(var(--ui-bg-elevated-rgb) / 75%);
    pointer-events: none;
  }

  .ui-modal-wrap {
    position: fixed;
    inset: 0;
    overflow: auto;
    outline: 0;
    -webkit-overflow-scrolling: touch;
  }

  .ui-modal-wrap[data-centered] {
    display: flex;
  }

  /* Окно уходит (анимация закрытия) — нажатия уже идут к странице под ним. */
  .ui-modal-wrap[data-state='closed'],
  .ui-modal-wrap[data-state='closed'] .ui-modal__content {
    pointer-events: none;
  }

  .ui-modal {
    position: relative;
    top: 100px;
    box-sizing: border-box;
    max-width: calc(100vw - 32px);
    margin: 0 auto;
    padding-bottom: calc(24px + var(--safe-bottom));
    color: var(--ui-text);
    font-size: 14px;
    line-height: 22px;
    pointer-events: none;
    outline: 0;
  }

  /* Центрированное окно по полям находит середину видимой части экрана,
     остальные — конец прокрутки (под строкой состояния и полосой жестов). */
  /* & явно: stylis приклеивает начальный :where( к корню без пробела. */
  & :where(.ui-modal-wrap[data-centered]) > .ui-modal {
    top: 0;
    margin: auto;
    padding-top: var(--safe-top);
    padding-bottom: var(--safe-bottom);
  }

  /* На телефоне высокое окно не прилипает к полосам: 8 px зазора. */
  ${() => SHELL.COMPACT} & :where(.ui-modal-wrap[data-centered]) > .ui-modal,
  ${() => SHELL.RAIL} & :where(.ui-modal-wrap[data-centered]) > .ui-modal {
    padding-top: calc(var(--safe-top) + 8px);
    padding-bottom: calc(var(--safe-bottom) + 8px);
  }

  /* Телефон боком: окна — от самого верха, под строкой состояния; окно —
     колонкой не выше видимой части, прокручивается только тело. */
  ${() => SHELL.RAIL} & :where(.ui-modal-wrap:not([data-centered])) > .ui-modal {
    top: calc(var(--safe-top) + 8px);
    padding-bottom: calc(var(--safe-bottom) + 8px);
  }

  ${() => SHELL.RAIL} & .ui-modal__content {
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - var(--safe-top) - var(--safe-bottom) - 16px);
    max-height: calc(100dvh - var(--safe-top) - var(--safe-bottom) - 16px);
  }

  ${() => SHELL.RAIL} & .ui-modal__body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
  }

  /* Окно вопроса (dialogs.ts): тело с отступами antd Modal.confirm. */
  .ui-modal.ui-confirm {
    --ui-modal-body-padding: 32px 32px 24px;
  }

  .ui-modal__content {
    position: relative;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-bg);
    box-shadow:
      0 0 0 1px var(--ui-border),
      var(--ui-shadow-lg);
    pointer-events: auto;
    outline: 0;
  }

  .ui-modal__close {
    position: absolute;
    top: 18px;
    right: 18px;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-muted);
    /* Крестик lucide занимает половину квадрата: 20px — как 14px у antd. */
    font-size: 20px;
    cursor: pointer;
    transition:
      color var(--transition-fast),
      background-color var(--transition-fast);
  }

  .ui-modal__close:hover {
    background: var(--ui-bg-elevated);
    color: var(--ui-text);
  }

  .ui-modal__close:focus {
    outline: 0;
  }

  .ui-modal__close:focus-visible {
    outline: var(--ui-focus-outline);
  }

  .ui-modal__header {
    padding: 16px 24px;
    border-bottom: 1px solid var(--ui-border);
  }

  .ui-modal__title {
    margin: 0;
    padding-right: 24px;
    color: var(--ui-text-highlighted);
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
    overflow-wrap: break-word;
  }

  .ui-modal__body {
    max-height: var(--modal-body-max-height);
    padding: var(--ui-modal-body-padding, 24px);
    overflow-y: auto;
    overflow-wrap: break-word;
  }

  .ui-modal__footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 24px;
    border-top: 1px solid var(--ui-border);
  }
`

// Окно вопроса или сообщения (confirm / info / …) как было у antd
// Modal.confirm в нашей теме: тело 32 / 32 / 24, значок вида 22px (16px до
// заголовка) слева от
// заголовка 16px, текст под заголовком, кнопки справа. Отступ тела окна —
// свой: --ui-modal-body-padding на панели .ui-confirm (style.css).
//
// Части: .ui-confirm__body, __icon, __text, __title, __content, __buttons;
// вид — data-kind.
export const SC_Confirm = styled.div`
  --ui-confirm-color: var(--ui-warning);

  &[data-kind='info'] {
    --ui-confirm-color: var(--ui-info);
  }

  &[data-kind='success'] {
    --ui-confirm-color: var(--ui-success);
  }

  &[data-kind='error'] {
    --ui-confirm-color: var(--ui-error);
  }

  .ui-confirm__body {
    display: flex;
    align-items: flex-start;
  }

  .ui-confirm__icon {
    flex: none;
    margin: 1px 16px 0 0;
    color: var(--ui-confirm-color);
    font-size: 22px;
    line-height: 0;
  }

  .ui-confirm__text {
    flex: auto;
    min-width: 0;
  }

  .ui-confirm__title {
    color: var(--ui-text-highlighted);
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
  }

  .ui-confirm__content {
    margin-top: 8px;
  }

  .ui-confirm__buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 24px;
  }
`
