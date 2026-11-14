import styled from 'vue3-styled-components'

// Меню как было у antd Dropdown + Menu в нашей теме (пока черновые размеры,
// уточняются замером).
//
// Части для styled родителя: .ui-menu, __item, __icon, __label, __divider;
// опасный пункт — data-danger, недоступный — aria-disabled.
export const SC_Menu = styled.ul`
  box-sizing: border-box;
  margin: 0;
  padding: 4px;
  overflow-y: auto;
  list-style: none;
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg);
  box-shadow:
    0 0 0 1px var(--ui-border),
    var(--ui-shadow-lg);
  color: var(--ui-text);
  font-size: 14px;
  line-height: 22px;
  outline: 0;

  .ui-menu__item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 5px 12px;
    border-radius: var(--ui-radius-sm);
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .ui-menu__item:hover,
  .ui-menu__item:focus {
    background: rgb(var(--ui-bg-elevated-rgb) / 50%);
    outline: 0;
  }

  .ui-menu__item[data-danger] {
    color: var(--ui-error);
  }

  .ui-menu__item[data-danger]:hover,
  .ui-menu__item[data-danger]:focus {
    background: var(--ui-error);
    color: var(--ui-text-inverted);
  }

  .ui-menu__item[aria-disabled='true'] {
    color: var(--ui-text-dimmed);
    background: none;
    cursor: not-allowed;
  }

  .ui-menu__icon {
    display: inline-flex;
    flex: none;
    min-width: 14px;
    font-size: 12px;
  }

  .ui-menu__label {
    flex: auto;
    min-width: 0;
  }

  .ui-menu__divider {
    height: 1px;
    margin: 4px 0;
    background: var(--ui-border);
  }
`
