import styled from 'vue3-styled-components'

// Карточка в оформлении Nuxt UI (UCard, outline): фон страницы, рамка
// --ui-border, радиус 8, без тени и без реакции на наведение. Тело — отступ
// --ui-card-padding (24px), свой блочный контекст, как было у antd Card:
// поля первого и последнего ребёнка не выходят за карточку.
//
// Части для styled родителя: .ui-card, .ui-card__body.
export const SC_Card = styled.div`
  position: relative;
  box-sizing: border-box;
  margin: 0;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg);
  color: var(--ui-text);
  font-size: 14px;
  line-height: 1.5714;

  .ui-card__body {
    display: flow-root;
    padding: var(--ui-card-padding, 24px);
    border-radius: 0 0 var(--ui-radius-lg) var(--ui-radius-lg);
  }
`
