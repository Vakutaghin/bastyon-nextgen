import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_HomeWork = styled.div`
  display: flex;
  flex: 1;
  max-width: 1600px;
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - 20px);
  gap: 20px;
  padding: 58px 0 25px;
  align-items: flex-start;
  background: rgb(255, 255, 255);

  &.is-mobile {
    gap: 0;
    padding: var(--header-height-total) 0 0;
  }
`

export const SC_HomeMainContent = styled.div`
  flex: 1;
  min-width: 0;
  background: rgb(255, 255, 255);
  padding: 20px 0;
  border-radius: 8px;

  &.sidebar-right-hidden {
    padding-right: 20px;
  }

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    padding: 12px 8px 16px;

    &.sidebar-right-hidden {
      padding-right: 8px;
    }
  }

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    padding: 8px 6px 12px;

    &.sidebar-right-hidden {
      padding-right: 6px;
    }
  }
`
