import styled from 'vue3-styled-components'

// Панель как была у antd Popover в нашей теме: фон страницы, кольцо-рамка и
// тень оверлеев, радиус 8, отступ 12, текст 14px. Слой (z-index) ставит стек.
//
// Части для styled родителя: .ui-popover, __title; отступ — --ui-popover-padding.
export const SC_Popover = styled.div`
  box-sizing: border-box;
  max-width: calc(100vw - 16px);
  padding: var(--ui-popover-padding, 12px);
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg);
  box-shadow:
    0 0 0 1px var(--ui-border),
    var(--ui-shadow-lg);
  color: var(--ui-text);
  font-size: 14px;
  line-height: 22px;
  text-align: start;

  &:focus {
    outline: 0;
  }

  .ui-popover__title {
    min-width: 177px;
    margin-bottom: 8px;
    color: var(--ui-text-highlighted);
    font-weight: 600;
  }
`
