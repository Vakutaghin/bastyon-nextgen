import styled from 'vue3-styled-components'

// Счётчик как у antd Badge: капсула 20px, 12px текст, кольцо цвета фона,
// центр — в правом верхнем углу содержимого. Цвет и смещение — переменными:
// --ui-badge-color, --ui-badge-text, --ui-badge-offset-x (вправо),
// --ui-badge-offset-y (вниз).
//
// Части для styled родителя: .ui-badge, .ui-badge__count.
export const SC_Badge = styled.span`
  position: relative;
  display: inline-block;
  color: inherit;
  font-size: 14px;
  line-height: 1;

  .ui-badge__count {
    position: absolute;
    top: var(--ui-badge-offset-y, 0);
    right: calc(-1 * var(--ui-badge-offset-x, 0px));
    z-index: auto;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-badge-color, var(--ui-primary));
    box-shadow: 0 0 0 1px var(--ui-bg);
    color: var(--ui-badge-text, var(--ui-text-inverted));
    font-size: 12px;
    font-weight: 400;
    line-height: 20px;
    text-align: center;
    white-space: nowrap;
    transform: translate(50%, -50%);
    transform-origin: 100% 0%;
  }

  .ui-badge__count[data-wide] {
    padding: 0 8px;
  }
`
