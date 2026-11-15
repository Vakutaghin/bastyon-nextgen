import styled from 'vue3-styled-components'

// Шторка как была у antd Drawer в нашей теме: фон страницы, тень шторки,
// шапка 10 / 16 с линией снизу (текст 16px), тело 20 / 24 / 32 с прокруткой;
// маска — дымка bg-elevated/75. Выезжает, как меню телефона, с «уменьшить движение» —
// только проявляется. Слой (z-index) ставит стек на корень.
//
// Части: .ui-drawer-root (data-placement), -mask, .ui-drawer, __header,
// __title, __close, __body. Отступы — --ui-drawer-header-padding,
// --ui-drawer-body-padding.
export const SC_DrawerRoot = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 0;
  height: 0;

  .ui-drawer-mask {
    position: fixed;
    inset: 0;
    background: rgb(var(--ui-bg-elevated-rgb) / 75%);
  }

  /* Шторка уходит — нажатия уже идут к странице под ней. */
  &[data-state='closed'] .ui-drawer-mask,
  &[data-state='closed'] .ui-drawer {
    pointer-events: none;
  }

  .ui-drawer {
    position: fixed;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    max-width: 100vw;
    max-height: 100vh;
    background: var(--ui-bg);
    color: var(--ui-text);
    font-size: 14px;
    outline: 0;
  }

  &[data-placement='right'] .ui-drawer {
    top: 0;
    right: 0;
    bottom: 0;
    box-shadow: var(--ui-shadow-drawer-right);
  }

  &[data-placement='left'] .ui-drawer {
    top: 0;
    bottom: 0;
    left: 0;
    box-shadow: var(--ui-shadow-drawer-left);
  }

  &[data-placement='bottom'] .ui-drawer {
    right: 0;
    bottom: 0;
    left: 0;
    box-shadow: var(--ui-shadow-drawer-bottom);
  }

  .ui-drawer__header {
    display: flex;
    flex: none;
    align-items: center;
    padding: var(--ui-drawer-header-padding, 10px 16px);
    border-bottom: 1px solid var(--ui-border);
    font-size: 16px;
    line-height: 24px;
  }

  .ui-drawer__title {
    flex: auto;
    min-width: 0;
    color: var(--ui-text-highlighted);
    font-weight: 600;
  }

  .ui-drawer__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    margin: 0 0 0 12px;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-muted);
    font-size: 20px;
    cursor: pointer;
  }

  .ui-drawer__close:hover {
    background: var(--ui-bg-elevated);
    color: var(--ui-text);
  }

  .ui-drawer__body {
    flex: auto;
    min-height: 0;
    padding: var(--ui-drawer-body-padding, 20px 24px 32px);
    overflow: auto;
  }

  .ui-drawer-enter-active,
  .ui-drawer-leave-active {
    transition: transform var(--transition-drawer);
  }

  &[data-placement='right'] .ui-drawer-enter-from,
  &[data-placement='right'] .ui-drawer-leave-to {
    transform: translateX(100%);
  }

  &[data-placement='left'] .ui-drawer-enter-from,
  &[data-placement='left'] .ui-drawer-leave-to {
    transform: translateX(-100%);
  }

  &[data-placement='bottom'] .ui-drawer-enter-from,
  &[data-placement='bottom'] .ui-drawer-leave-to {
    transform: translateY(100%);
  }

  @media (prefers-reduced-motion: reduce) {
    .ui-drawer-enter-active,
    .ui-drawer-leave-active {
      transition: opacity var(--transition-fast);
    }

    &[data-placement] .ui-drawer-enter-from,
    &[data-placement] .ui-drawer-leave-to {
      opacity: 0;
      transform: none;
    }
  }
`
