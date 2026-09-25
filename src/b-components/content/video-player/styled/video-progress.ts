// @ts-expect-error vue3-styled-components types
import styled from 'vue3-styled-components'

export const SC_VideoProgressBar = styled.div`
  flex: 1 1 0;
  min-width: 0;
  width: 100%;
  height: 6px;
  min-height: 6px;
  max-height: 6px;
  background-color: var(--color-overlay-20);
  border-radius: var(--ui-radius-xs);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition:
    height 0.15s ease,
    background-color 0.15s ease;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
  margin: 0;
  padding: 0;
  display: block;
  align-self: center;
  box-sizing: border-box;
  touch-action: none;

  > * {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
  }

  &:hover {
    height: 8px;
    min-height: 8px;
    max-height: 8px;
    background-color: var(--color-overlay-30);

    /* Акцент — только полоске прогресса, не первому ребёнку (полоске загрузки). */
    > *:not(:first-child) {
      background: var(--ui-color-primary-400);
      box-shadow: none;
    }
  }

  /* Mobile: толще progress + увеличенная hit-area через ::before для удобного тапа.
     6px полоса с +12px невидимой вверх/вниз = 30px total touch-target. */
  @media (max-width: 768px) {
    height: 8px;
    min-height: 8px;
    max-height: 8px;
    border-radius: var(--ui-radius-sm);

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
    height: 10px;
    min-height: 10px;
    max-height: 10px;
    border-radius: var(--ui-radius-sm);
  }
`

export const SC_VideoProgressFill = styled.div`
  height: 100%;
  width: 0%;
  /* Акцент Nuxt UI вместо красного YouTube. Плеер тёмный в обеих темах,
     поэтому всегда яркий оттенок (400). */
  background: var(--ui-color-primary-400);
  border-radius: var(--ui-radius-xs);
  transition:
    background 0.15s ease,
    box-shadow 0.15s ease;
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: auto;
  display: block;
  pointer-events: none;
  box-sizing: border-box;
  z-index: 2;
  min-width: 0;
  opacity: 1;
  visibility: visible;
  will-change: width;
`

export const SC_VideoBufferFill = styled.div`
  height: 100%;
  width: 0%;
  background: var(--color-white-60);
  opacity: 0.5;
  border-radius: var(--ui-radius-xs);
  transition: width 0.2s ease;
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: auto;
  display: block;
  pointer-events: none;
  box-sizing: border-box;
  z-index: 1;
  opacity: 1;
  visibility: visible;
  min-width: 0;
  will-change: width;
`
