import styled from 'vue3-styled-components'

import { BREAKPOINTS, FONT_SIZE, SPACING } from '@/styles/design-tokens'

export const SC_ComposePage = styled.div`
  display: flex;
  justify-content: center;
  /* Шапка своей высоты на телефоне и со строкой состояния, а не 64px. */
  padding: calc(var(--header-height-total) + ${SPACING.LG}) ${SPACING.MD} ${SPACING.XL};
  background: var(--color-bg-primary);
  min-height: 100vh;

  /* Телефон: форма во всю ширину, без полей страницы. */
  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    padding: calc(var(--header-height-total) + ${SPACING.SM}) 0 ${SPACING.MD};
    background: var(--ui-bg);
  }
`

export const SC_ComposeCard = styled.div`
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: ${SPACING.MD};
  padding: ${SPACING.LG};
  /* Карточка outline, как остальные: заливка muted в тёмной теме совпадала
     с цветом рамок полей внутри. */
  background: var(--ui-bg);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);

  /* Телефон: без рамки карточки — поля страницы и карточки вместе съедали
     с каждой стороны по 40 px. */
  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    gap: 12px;
    padding: 0 12px;
    border: 0;
    border-radius: 0;
  }
`

export const SC_ComposeTitle = styled.h1`
  margin: 0;
  font-size: ${FONT_SIZE.HEADING};
  font-weight: 600;
  color: var(--ui-text-highlighted);

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    font-size: ${FONT_SIZE.XL};
  }
`
