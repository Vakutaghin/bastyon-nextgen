import styled from 'vue3-styled-components'

import { FONT_SIZE, LAYOUT, SPACING } from '@/styles/design-tokens'

export const SC_ComposePage = styled.div`
  display: flex;
  justify-content: center;
  padding: calc(${LAYOUT.HEADER_HEIGHT} + ${SPACING.LG}) ${SPACING.MD} ${SPACING.XL};
  background: var(--color-bg-primary);
  min-height: 100vh;
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
`

export const SC_ComposeTitle = styled.h1`
  margin: 0;
  font-size: ${FONT_SIZE.HEADING};
  font-weight: 600;
  color: var(--ui-text-highlighted);
`
