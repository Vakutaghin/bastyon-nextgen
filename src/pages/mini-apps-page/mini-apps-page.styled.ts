import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_Page = styled.main`
  width: 100%;
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--header-height-total) var(--content-padding-x) 24px;
  min-height: calc(100vh - var(--header-height));
  background: ${COLORS.WHITE};
`

export const SC_Title = styled.h1`
  font-size: 22px;
  font-weight: 600;
  color: ${COLORS.GRAY_212};
  margin: 24px 0 8px;
`

export const SC_Subtitle = styled.p`
  font-size: 13px;
  color: ${COLORS.OVERLAY_55};
  margin: 0 0 16px;
`
