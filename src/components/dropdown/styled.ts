import styled from 'vue3-styled-components'

// Сама панель прозрачная, как у antd: вид даёт Menu или карточка содержимого.
// Высоту содержимого (меню или карточки) ограничивает место до края экрана
// (--ui-floating-available-height ставит floating.ts) — длинное на низком
// экране прокручивается. Своё ограничение карточки — min() с той же переменной.
//
// Части для styled родителя: .ui-dropdown; кнопка — .ui-dropdown-trigger,
// открытая — .ui-dropdown-open.
export const SC_Dropdown = styled.div`
  box-sizing: border-box;
  max-width: var(--ui-floating-available-width, calc(100vw - 16px));

  &:focus {
    outline: 0;
  }

  & > * {
    max-height: var(--ui-floating-available-height, none);
    overflow-y: auto;
  }
`
