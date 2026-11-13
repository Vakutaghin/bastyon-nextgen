import styled from 'vue3-styled-components'

// Переключатель вариантов как был у antd в нашей теме: подложка bg-muted с
// отступом 2px, выбранный — светлая плашка с тенью, которая едет к нему.
// Высота вариантов 28px (маленький — 24px), текст приглушённый, у выбранного
// и на наведении — основной.
//
// Части для styled родителя: .ui-segmented, __group, __thumb, __item, __label.
export const SC_Segmented = styled.div`
  --ui-segmented-h: 28px;
  --ui-segmented-pad-x: 11px;

  display: inline-block;
  box-sizing: border-box;
  max-width: 100%;
  padding: 2px;
  border-radius: var(--ui-radius-md);
  background: var(--ui-bg-muted);
  color: var(--ui-text-muted);
  font-size: 14px;
  vertical-align: middle;

  &[data-size='small'] {
    --ui-segmented-h: 24px;
    --ui-segmented-pad-x: 7px;
    --ui-segmented-item-radius: var(--ui-radius-xs);

    border-radius: var(--ui-radius-sm);
  }

  &[data-block] {
    display: flex;
    width: 100%;
  }

  .ui-segmented__group {
    position: relative;
    display: flex;
    align-items: stretch;
    width: 100%;
  }

  .ui-segmented__thumb {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    border-radius: var(--ui-segmented-item-radius, var(--ui-radius-sm));
    background: var(--ui-bg);
    box-shadow:
      0 0 0 1px var(--ui-border),
      var(--ui-shadow-lg);
    opacity: 0;
    pointer-events: none;
    transition:
      transform var(--transition-normal),
      width var(--transition-normal);
  }

  .ui-segmented__item {
    position: relative;
    z-index: 1;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: var(--ui-segmented-item-radius, var(--ui-radius-sm));
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: center;
    cursor: pointer;
    transition: color var(--transition-fast);
  }

  &[data-block] .ui-segmented__item {
    flex: 1 1 0;
  }

  .ui-segmented__item:hover:not(:disabled, [aria-checked='true']) {
    color: var(--ui-text);
    background: var(--ui-bg-elevated);
  }

  .ui-segmented__item[aria-checked='true'] {
    color: var(--ui-text);
  }

  .ui-segmented__item:disabled {
    color: var(--ui-text-dimmed);
    cursor: not-allowed;
  }

  .ui-segmented__item:focus {
    outline: 0;
  }

  .ui-segmented__item:focus-visible {
    outline: var(--ui-focus-outline);
  }

  .ui-segmented__label {
    display: block;
    overflow: hidden;
    min-height: var(--ui-segmented-h);
    padding: 0 var(--ui-segmented-pad-x);
    line-height: var(--ui-segmented-h);
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  @media (prefers-reduced-motion: reduce) {
    .ui-segmented__thumb {
      transition: none;
    }
  }
`
