import styled from 'vue3-styled-components'

// Поле ввода в оформлении Nuxt UI (UInput, вариант outline): фон страницы,
// рамка accented, радиус 6; на hover рамка не меняется, в фокусе — акцентная
// рамка и ореол 3px. Цвета antd уже задаёт тема (styles/antd-theme.ts), здесь —
// то, в чём Nuxt расходится с antd.
//
// Antd Input НЕ телепортится — он живёт внутри этой обёртки, поэтому вложенный
// селектор .ant-input работает напрямую (:deep() в vue3-styled-components не
// функционирует). При allow-clear / prefix / suffix antd оборачивает input в
// .ant-input-affix-wrapper — фон и рамку рисует он.
export const SC_Input = styled.div`
  /* Поле тянется на ширину контейнера (w-full у Nuxt). Класс styled-обёртки
     уходит во внутренний antd-инпут, а этот div во flex-строке сжимался до
     ширины содержимого — поле мнемоники при входе было узким. */
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;

  .ant-input,
  .ant-input-affix-wrapper {
    background: var(--ui-bg);
    color: var(--ui-text-highlighted);
    border-color: var(--ui-border-accented);
    border-radius: var(--ui-radius-md);
  }

  .ant-input-affix-wrapper > .ant-input {
    background: transparent;
    border: none;
    box-shadow: none;
  }

  .ant-input:hover:not(:disabled),
  .ant-input-affix-wrapper:hover {
    border-color: var(--ui-border-accented);
  }

  .ant-input:focus,
  .ant-input-focused,
  .ant-input-affix-wrapper-focused {
    border-color: var(--ui-primary);
    box-shadow: 0 0 0 3px rgb(var(--ui-primary-rgb) / 25%);
  }

  .ant-input::placeholder {
    color: var(--ui-text-dimmed);
  }

  .ant-input-clear-icon {
    color: var(--ui-text-dimmed);
  }

  .ant-input-clear-icon:hover {
    color: var(--ui-text);
  }

  .ant-input:disabled,
  .ant-input-affix-wrapper-disabled {
    background: var(--ui-bg);
    cursor: not-allowed;
    opacity: 0.75;
  }
`
