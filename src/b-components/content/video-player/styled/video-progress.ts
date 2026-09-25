// @ts-expect-error vue3-styled-components types
import styled from 'vue3-styled-components'

export const SC_VideoProgressBar = styled.div`
  flex: 1 1 0 !important;
  min-width: 0 !important;
  width: 100% !important;
  height: 6px !important;
  min-height: 6px !important;
  max-height: 6px !important;
  background-color: var(--color-overlay-20) !important;
  border-radius: var(--ui-radius-xs) !important;
  cursor: pointer !important;
  position: relative !important;
  overflow: hidden !important;
  transition:
    height 0.15s ease,
    background-color 0.15s ease !important;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2) !important;
  margin: 0 !important;
  padding: 0 !important;
  display: block !important;
  align-self: center !important;
  box-sizing: border-box !important;
  touch-action: none !important;

  > * {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    height: 100% !important;
  }

  &:hover {
    height: 8px !important;
    min-height: 8px !important;
    max-height: 8px !important;
    background-color: var(--color-overlay-30) !important;

    /* Акцент — только полоске прогресса, не первому ребёнку (полоске загрузки). */
    > *:not(:first-child) {
      background: var(--ui-color-primary-400) !important;
      box-shadow: none !important;
    }
  }

  /* Mobile: толще progress + увеличенная hit-area через ::before для удобного тапа.
     6px полоса с +12px невидимой вверх/вниз = 30px total touch-target. */
  @media (max-width: 768px) {
    height: 8px !important;
    min-height: 8px !important;
    max-height: 8px !important;
    border-radius: var(--ui-radius-sm) !important;

    &::before {
      content: '';
      position: absolute;
      top: -12px;
      bottom: -12px;
      left: 0;
      right: 0;
      z-index: 3;
    }
  }

  @media (max-width: 480px) {
    height: 10px !important;
    min-height: 10px !important;
    max-height: 10px !important;
    border-radius: var(--ui-radius-sm) !important;
  }
`

export const SC_VideoProgressFill = styled.div`
  height: 100% !important;
  width: 0%;
  /* Акцент Nuxt UI вместо красного YouTube. Плеер тёмный в обеих темах,
     поэтому всегда яркий оттенок (400). */
  background: var(--ui-color-primary-400) !important;
  border-radius: var(--ui-radius-xs) !important;
  transition:
    background 0.15s ease,
    box-shadow 0.15s ease !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  bottom: 0 !important;
  right: auto !important;
  display: block !important;
  pointer-events: none !important;
  box-sizing: border-box !important;
  z-index: 2 !important;
  min-width: 0 !important;
  opacity: 1 !important;
  visibility: visible !important;
  will-change: width !important;
`

export const SC_VideoBufferFill = styled.div`
  height: 100% !important;
  width: 0%;
  background: var(--color-white-60) !important;
  opacity: 0.5;
  border-radius: var(--ui-radius-xs) !important;
  transition: width 0.2s ease !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  bottom: 0 !important;
  right: auto !important;
  display: block !important;
  pointer-events: none !important;
  box-sizing: border-box !important;
  z-index: 1 !important;
  opacity: 1 !important;
  visibility: visible !important;
  min-width: 0 !important;
  will-change: width !important;
`
