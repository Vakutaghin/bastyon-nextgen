import styled, { keyframes } from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

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
    background: ${COLORS.PRIMARY};
    border-color: ${COLORS.PRIMARY};
    color: ${COLORS.BG_PRIMARY};

    &:hover:not(:disabled) {
      background: ${COLORS.PRIMARY_ACTIVE};
      border-color: ${COLORS.PRIMARY_ACTIVE};
    }

    &:active:not(:disabled) {
      background: ${COLORS.PRIMARY_DARK};
      border-color: ${COLORS.PRIMARY_DARK};
    }
  }

  /* Primary danger variant */
  &.bastyon-button-primary.bastyon-button-danger {
    background: ${COLORS.DANGER};
    border-color: ${COLORS.DANGER};
    color: ${COLORS.BG_PRIMARY};

    &:hover:not(:disabled) {
      background: ${COLORS.DANGER_HOVER};
      border-color: ${COLORS.DANGER_HOVER};
    }

    &:active:not(:disabled) {
      background: ${COLORS.DANGER_ACTIVE};
      border-color: ${COLORS.DANGER_ACTIVE};
    }
  }

  /* Secondary variant (default) */
  &.bastyon-button-secondary,
  &:not(.bastyon-button-primary):not(.bastyon-button-danger) {
    background: ${COLORS.BG_PRIMARY};
    border-color: ${COLORS.BORDER};
    color: ${COLORS.TEXT_PRIMARY};

    &:hover:not(:disabled) {
      background: ${COLORS.BG_SECONDARY};
      border-color: ${COLORS.PRIMARY};
      color: ${COLORS.PRIMARY};
    }

    &:active:not(:disabled) {
      background: ${COLORS.BG_DISABLED};
      border-color: ${COLORS.PRIMARY_ACTIVE};
      color: ${COLORS.PRIMARY_ACTIVE};
    }
  }

  /* Secondary danger variant */
  &.bastyon-button-secondary.bastyon-button-danger,
  &.bastyon-button-danger:not(.bastyon-button-primary) {
    background: ${COLORS.BG_PRIMARY};
    border-color: ${COLORS.DANGER};
    color: ${COLORS.DANGER};

    &:hover:not(:disabled) {
      background: ${COLORS.BG_SECONDARY};
      border-color: ${COLORS.DANGER_HOVER};
      color: ${COLORS.DANGER_HOVER};
    }

    &:active:not(:disabled) {
      background: ${COLORS.BG_DISABLED};
      border-color: ${COLORS.DANGER_ACTIVE};
      color: ${COLORS.DANGER_ACTIVE};
    }
  }

  /* Disabled state */
  &:disabled {
    background: ${COLORS.BG_DISABLED} !important;
    border-color: ${COLORS.BORDER} !important;
    color: ${COLORS.TEXT_SECONDARY} !important;
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
    box-shadow: 0 0 0 2px ${COLORS.PRIMARY_LIGHT_20};
  }

  &:focus:not(:focus-visible) {
    box-shadow: none;
  }
`
