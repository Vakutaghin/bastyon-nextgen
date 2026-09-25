import styled from 'vue3-styled-components'

// Кнопка в оформлении Nuxt UI (UButton): высота 28 / 32 / 40, 500-е начертание,
// радиус 6. Рамка — кольцом (box-shadow), чтобы не менять размеры.
//
// primary          → solid: заливка акцентом, текст --ui-text-inverted
// primary + danger → solid цветом ошибки
// secondary        → нейтральная outline: кольцо accented, hover — подложка
// danger           → outline цветом ошибки
// link             → только текст акцентом

/** Спиннер цветом текста кнопки (раньше — <img>, где currentColor не работает). */
export const SC_ButtonSpinner = styled.span`
  display: inline-block;
  flex-shrink: 0;
  width: 1em;
  height: 1em;
  margin-right: 6px;
  border: 2px solid currentcolor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
`

export const SC_ButtonMore = styled.button<{ size?: string; block?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: ${(p) => (p.block ? '100%' : 'auto')};
  padding: ${(p) => (p.size === 'large' ? '8px 12px' : '6px 10px')};
  border: 0;
  border-radius: var(--ui-radius-md);
  font-size: ${(p) => {
    if (p.size === 'large') return '16px'
    if (p.size === 'small') return '12px'
    return '14px'
  }};
  font-weight: 500;
  line-height: ${(p) => {
    if (p.size === 'large') return '24px'
    if (p.size === 'small') return '16px'
    return '20px'
  }};
  text-align: center;
  white-space: nowrap;
  vertical-align: middle;
  cursor: pointer;
  user-select: none;
  transition:
    background-color 0.15s,
    color 0.15s,
    box-shadow 0.15s;

  &.bastyon-button-primary {
    background: var(--ui-primary);
    color: var(--ui-text-inverted);

    &:hover:not(:disabled),
    &:active:not(:disabled) {
      background: rgb(var(--ui-primary-rgb) / 75%);
      color: var(--ui-text-inverted);
    }
  }

  &.bastyon-button-primary.bastyon-button-danger {
    background: var(--ui-error);

    &:hover:not(:disabled),
    &:active:not(:disabled) {
      background: rgb(var(--ui-error-rgb) / 75%);
    }
  }

  &.bastyon-button-secondary,
  &:not(.bastyon-button-primary, .bastyon-button-danger, .bastyon-button-link) {
    background: var(--ui-bg);
    color: var(--ui-text);
    box-shadow: inset 0 0 0 1px var(--ui-border-accented);

    &:hover:not(:disabled),
    &:active:not(:disabled) {
      background: var(--ui-bg-elevated);
      color: var(--ui-text);
    }
  }

  &.bastyon-button-secondary.bastyon-button-danger,
  &.bastyon-button-danger:not(.bastyon-button-primary) {
    background: transparent;
    color: var(--ui-error);
    box-shadow: inset 0 0 0 1px rgb(var(--ui-error-rgb) / 50%);

    &:hover:not(:disabled),
    &:active:not(:disabled) {
      background: rgb(var(--ui-error-rgb) / 10%);
      color: var(--ui-error);
    }
  }

  &.bastyon-button-link {
    background: transparent;
    color: var(--ui-primary-text);

    &:hover:not(:disabled),
    &:active:not(:disabled) {
      background: transparent;
      color: rgb(var(--ui-primary-rgb) / 75%);
    }
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.75;
  }

  &.bastyon-button-loading {
    pointer-events: none;
  }

  &:focus {
    outline: 0;
  }

  &:focus-visible {
    outline: var(--ui-focus-outline);
  }
`
