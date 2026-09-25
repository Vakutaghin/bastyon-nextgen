import styled from 'vue3-styled-components'

// Карточка в оформлении Nuxt UI (UCard, outline): фон страницы, рамка
// --ui-border, радиус 8, без тени.
//
// Раньше здесь было `.ant-card-body * { color: … !important }` — оно красило в
// основной цвет весь текст карточки поста, и вложенным компонентам приходилось
// перебивать его своими !important. Цвет теперь наследуется от тела карточки.
export const SC_Card = styled.div`
  .ant-card {
    background: var(--ui-bg);
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-lg);
    box-shadow: none;
  }

  /* hoverable у antd на наведении прячет рамку и поднимает тень, а курсор
     делает «рукой», хотя карточка поста целиком не кликается. У Nuxt карточка
     на наведение не реагирует. */
  .ant-card-hoverable {
    cursor: auto;
  }

  .ant-card-hoverable:hover {
    border-color: var(--ui-border);
    box-shadow: none;
  }

  .ant-card-head {
    border-bottom: 1px solid var(--ui-border);
    background: transparent;
  }

  .ant-card-head-title {
    color: var(--ui-text-highlighted);
    font-weight: 600;
  }

  .ant-card-body {
    color: var(--ui-text);
    background: transparent;
  }
`
