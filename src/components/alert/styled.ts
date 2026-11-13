import styled from 'vue3-styled-components'

// Плашка: подложка и рамка — цвет вида с прозрачностью, значок — цвет вида,
// текст — основной. Размеры как у antd Alert с описанием: отступы 20 / 24,
// значок 24px, радиус 8.
//
// Части для styled родителя: .ui-alert, __icon, __content, __title,
// __description. Цвет вида — --ui-alert-rgb (тройка чисел, как --ui-info-rgb).
export const SC_Alert = styled.div`
  --ui-alert-rgb: var(--ui-info-rgb);

  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 20px 24px;
  border: 1px solid rgb(var(--ui-alert-rgb) / 35%);
  border-radius: var(--ui-radius-lg);
  background: rgb(var(--ui-alert-rgb) / 8%);
  color: var(--ui-text);
  font-size: 14px;
  line-height: 22px;

  &[data-type='success'] {
    --ui-alert-rgb: var(--ui-success-rgb);
  }

  &[data-type='warning'] {
    --ui-alert-rgb: var(--ui-warning-rgb);
  }

  &[data-type='error'] {
    --ui-alert-rgb: var(--ui-error-rgb);
  }

  .ui-alert__icon {
    flex: 0 0 auto;
    color: rgb(var(--ui-alert-rgb));
    font-size: 24px;
    line-height: 1;
  }

  .ui-alert__content {
    flex: 1 1 auto;
    min-width: 0;
  }

  .ui-alert__title {
    margin-bottom: 4px;
    color: var(--ui-text-highlighted);
    font-size: 16px;
    line-height: 24px;
  }
`
