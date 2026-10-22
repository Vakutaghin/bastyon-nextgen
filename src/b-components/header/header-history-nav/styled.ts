import styled from 'vue3-styled-components'

export const SC_HistoryNav = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
`

// Выключенная кнопка — aria-disabled, а не disabled: у disabled браузер не
// шлёт mouseleave, и подсказка залипала бы на кнопке, ставшей неактивной.
export const SC_HistoryButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  background: transparent;
  border: none;
  border-radius: var(--ui-radius-md);
  color: var(--ui-text);
  cursor: pointer;
  transition: background-color var(--transition-fast);
  -webkit-tap-highlight-color: transparent;

  & .anticon {
    font-size: 20px;
  }

  &:hover,
  &:active {
    background-color: var(--ui-bg-elevated);
  }

  &[aria-disabled='true'] {
    color: var(--ui-text-dimmed);
    background-color: transparent;
    cursor: default;
  }
`
