import styled from 'vue3-styled-components'

// Сама панель прозрачная, как у antd: вид даёт Menu или карточка содержимого.
// Высоту меню ограничивает место до края экрана (--ui-floating-available-height
// ставит floating.ts) — длинное меню на низком экране прокручивается.
//
// Части для styled родителя: .ui-dropdown; кнопка — .ui-dropdown-trigger,
// открытая — .ui-dropdown-open.
export const SC_Dropdown = styled.div`
  box-sizing: border-box;
  max-width: calc(100vw - 16px);

  &:focus {
    outline: 0;
  }

  & > .ui-menu {
    max-height: var(--ui-floating-available-height, none);
  }
`
