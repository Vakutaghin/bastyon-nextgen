import styled from 'vue3-styled-components'

// Многострочное поле в оформлении однострочного (components/input): поля 4/11,
// текст 14/22, рамка border-accented, радиус 6, в фокусе — акцентная рамка и
// ореол. С autoSize тянуть за угол нельзя — высоту задаёт текст.
//
// Части для styled родителя: .ui-textarea, __control, __count.
export const SC_TextArea = styled.div`
  --ui-input-ring: var(--ui-primary-rgb);

  display: block;
  width: 100%;
  min-width: 0;

  &[data-status='error'] {
    --ui-input-ring: var(--ui-error-rgb);
  }

  &[data-status='warning'] {
    --ui-input-ring: var(--ui-warning-rgb);
  }

  .ui-textarea__control {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    min-height: 32px;
    margin: 0;
    padding: 4px 11px;
    font: inherit;
    font-size: 14px;
    line-height: 22px;
    color: var(--ui-text-highlighted);
    background: var(--ui-bg);
    border: 1px solid var(--ui-border-accented);
    border-radius: var(--ui-radius-md);
    outline: 0;
    resize: vertical;
    transition:
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);
  }

  &[data-auto-size] .ui-textarea__control {
    resize: none;
  }

  .ui-textarea__control::placeholder {
    color: var(--ui-text-dimmed);
  }

  .ui-textarea__control:focus {
    border-color: rgb(var(--ui-input-ring));
    box-shadow: 0 0 0 3px rgb(var(--ui-input-ring) / 25%);
  }

  &[data-status='error'] .ui-textarea__control {
    border-color: var(--ui-error);
  }

  &[data-status='warning'] .ui-textarea__control {
    border-color: var(--ui-warning);
  }

  &[data-disabled] .ui-textarea__control {
    cursor: not-allowed;
    opacity: 0.75;
  }

  .ui-textarea__count {
    display: block;
    font-size: 14px;
    line-height: 22px;
    color: var(--ui-text-muted);
    text-align: end;
    white-space: nowrap;
  }
`
