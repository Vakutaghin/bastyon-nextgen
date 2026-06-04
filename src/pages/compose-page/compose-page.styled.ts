import styled from 'vue3-styled-components'

import { BORDER_RADIUS, FONT_SIZE, LAYOUT, SPACING } from '@/styles/design-tokens'
import { COLORS } from '@/styles/theme-colors'

export const SC_ComposePage = styled.div`
  display: flex;
  justify-content: center;
  padding: calc(${LAYOUT.HEADER_HEIGHT} + ${SPACING.LG}) ${SPACING.MD} ${SPACING.XL};
  background: ${COLORS.BG_PRIMARY};
  min-height: 100vh;
`

export const SC_ComposeCard = styled.div`
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: ${SPACING.MD};
  padding: ${SPACING.LG};
  background: ${COLORS.BG_SECONDARY};
  border-radius: ${BORDER_RADIUS.LG};
`

export const SC_ComposeTitle = styled.h1`
  margin: 0;
  font-size: ${FONT_SIZE.HEADING};
  color: ${COLORS.TEXT_PRIMARY};
`
