import styled, { keyframes } from 'vue3-styled-components'

const spinKeyframes = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`

export const SC_ButtonLoadingWrap = styled.span`
  margin-right: 8px;
  display: inline-flex;

  img {
    animation: ${spinKeyframes} 1s linear infinite;
  }
`

export const SC_ButtonMore = styled.button<{ size?: string; block?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 400;
  text-align: center;
  white-space: nowrap;
  vertical-align: middle;
  cursor: pointer;
  user-select: none;
  border: 1px solid transparent;
  padding: ${(p) => {
    if (p.size === 'large') return '8px 20px'
    if (p.size === 'small') return '4px 12px'
    return '6px 16px'
  }};
  font-size: ${(p) => {
    if (p.size === 'large') return '16px'
    if (p.size === 'small') return '12px'
    return '16px'
  }};
  line-height: 1.5;
  border-radius: 4px;
  transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);
  width: ${(p) => p.block ? '100%' : 'auto'};

  /* Primary variant */
  &.bastyon-button-primary {
    background: rgb(0, 123, 255);
    border-color: rgb(0, 123, 255);
    color: rgb(255, 255, 255);

    &:hover:not(:disabled) {
      background: rgb(0, 86, 179);
      border-color: rgb(0, 86, 179);
    }

    &:active:not(:disabled) {
      background: rgb(0, 70, 150);
      border-color: rgb(0, 70, 150);
    }
  }

  /* Primary danger variant */
  &.bastyon-button-primary.bastyon-button-danger {
    background: rgb(220, 53, 69);
    border-color: rgb(220, 53, 69);
    color: rgb(255, 255, 255);

    &:hover:not(:disabled) {
      background: rgb(200, 35, 51);
      border-color: rgb(200, 35, 51);
    }

    &:active:not(:disabled) {
      background: rgb(180, 20, 35);
      border-color: rgb(180, 20, 35);
    }
  }

  /* Secondary variant (default) */
  &.bastyon-button-secondary,
  &:not(.bastyon-button-primary):not(.bastyon-button-danger) {
    background: rgb(255, 255, 255);
    border-color: rgb(206, 212, 218);
    color: rgb(33, 37, 41);

    &:hover:not(:disabled) {
      background: rgb(248, 249, 250);
      border-color: rgb(0, 123, 255);
      color: rgb(0, 123, 255);
    }

    &:active:not(:disabled) {
      background: rgb(233, 236, 239);
      border-color: rgb(0, 86, 179);
      color: rgb(0, 86, 179);
    }
  }

  /* Secondary danger variant */
  &.bastyon-button-secondary.bastyon-button-danger,
  &.bastyon-button-danger:not(.bastyon-button-primary) {
    background: rgb(255, 255, 255);
    border-color: rgb(220, 53, 69);
    color: rgb(220, 53, 69);

    &:hover:not(:disabled) {
      background: rgb(248, 249, 250);
      border-color: rgb(200, 35, 51);
      color: rgb(200, 35, 51);
    }

    &:active:not(:disabled) {
      background: rgb(233, 236, 239);
      border-color: rgb(180, 20, 35);
      color: rgb(180, 20, 35);
    }
  }

  /* Disabled state */
  &:disabled {
    background: rgb(233, 236, 239) !important;
    border-color: rgb(206, 212, 218) !important;
    color: rgb(108, 117, 125) !important;
    cursor: not-allowed !important;
    opacity: 0.6;
  }

  /* Loading state */
  &.bastyon-button-loading {
    pointer-events: none;
    opacity: 0.65;
    cursor: not-allowed;
  }

  /* Focus state */
  &:focus {
    outline: 0;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.2);
  }

  &:focus:not(:focus-visible) {
    box-shadow: none;
  }
`
