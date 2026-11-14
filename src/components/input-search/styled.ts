import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

// Поиск как был у antd в нашей теме: поле (components/input) и приставленная
// справа кнопка 46×32 с заливкой акцентом; у поля срезаны правые углы, у
// кнопки — левые. Кнопка заходит на рамку поля на 1px, в фокусе поле с
// ореолом — поверх неё.
//
// Части для styled родителя: .ui-input-search, __field, __button.
export const SC_InputSearch = styled.div`
  display: flex;
  width: 45%;
  flex-shrink: 0;

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    width: 100%;
    flex-shrink: 1;
  }

  .ui-input-search__field {
    --ui-input-radius: var(--ui-radius-md) 0 0 var(--ui-radius-md);

    flex: 1 1 auto;
  }

  .ui-input-search__field:focus-within {
    z-index: 1;
  }

  .ui-input-search__button {
    position: relative;
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: 46px;
    margin: 0 0 0 -1px;
    padding: 0 15px;
    font-size: 14px;
    line-height: 22px;
    color: var(--ui-text-inverted);
    background: var(--ui-primary);
    border: 1px solid transparent;
    border-radius: 0 var(--ui-radius-md) var(--ui-radius-md) 0;
    cursor: pointer;
    transition: background-color var(--transition-quick);
  }

  .ui-input-search__button:hover:not(:disabled) {
    background: rgb(var(--ui-primary-rgb) / 75%);
  }

  .ui-input-search__button:disabled {
    cursor: not-allowed;
    opacity: 0.75;
  }
`
