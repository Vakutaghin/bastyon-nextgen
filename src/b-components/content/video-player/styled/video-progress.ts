// @ts-expect-error vue3-styled-components types
import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

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
    height var(--transition-quick),
    background-color var(--transition-quick);
  box-shadow: inset 0 1px 2px rgb(var(--color-black-rgb) / 20%);
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
      background: var(--ui-primary-on-dark);
      box-shadow: none;
    }
  }

  /* Mobile: толще progress + увеличенная hit-area через ::before для удобного тапа.
     6px полоса с +12px невидимой вверх/вниз = 30px total touch-target. */
  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    height: 8px;
    min-height: 8px;
    max-height: 8px;
    border-radius: var(--ui-radius-sm);

    &::before {
      content: '';
      position: absolute;
      inset: -12px 0;
      z-index: 3;
    }
  }

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    height: 10px;
    min-height: 10px;
    max-height: 10px;
    border-radius: var(--ui-radius-sm);
  }
`

export const SC_VideoProgressFill = styled.div`
  height: 100%;
  width: 0%;
  /* Акцент вместо красного YouTube. Плеер тёмный в обеих темах, поэтому
     яркий оттенок акцента, а не --ui-primary. */
  background: var(--ui-primary-on-dark);
  border-radius: var(--ui-radius-xs);
  transition:
    background var(--transition-quick),
    box-shadow var(--transition-quick);
  position: absolute;
  inset: 0 auto 0 0;
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
  border-radius: var(--ui-radius-xs);
  transition: width var(--transition-fast);
  position: absolute;
  inset: 0 auto 0 0;
  display: block;
  pointer-events: none;
  box-sizing: border-box;
  z-index: 1;
  opacity: 1;
  visibility: visible;
  min-width: 0;
  will-change: width;
`
