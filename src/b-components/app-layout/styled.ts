import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_Application = styled.div`
  width: 100%;
  min-height: 100vh;
  position: relative;
`

export const SC_Camera = styled.div`
  display: none;
`

export const SC_Appcnt = styled.div`
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding-bottom: var(--safe-bottom);
`

export const SC_Work = styled.div`
  display: flex;
  flex: 1;
  max-width: var(--content-max-width);
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - var(--header-height));
  gap: var(--content-gap);
  padding: calc(var(--header-height) - 2px) 0 25px;
  align-items: flex-start;
  background: ${COLORS.BG_PRIMARY};
`

export const SC_MainContent = styled.div`
  flex: 1;
  min-width: 0;
  background: ${COLORS.BG_PRIMARY};
  padding: 20px 0;
  border-radius: 8px;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    padding: 12px 8px 16px;
  }

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    padding: 8px 6px 12px;
  }
`

export const SC_SidebarRight = styled.div`
  width: 320px;
  flex-shrink: 0;
  position: sticky;
  top: calc(var(--header-height) + 25px);
  height: fit-content;
  max-height: calc(100vh - var(--header-height) - 40px);
  background: ${COLORS.BG_PRIMARY};
  padding: 20px;
  border-radius: 8px;
  box-shadow: ${COLORS.SHADOW_SM};
  border: 1px solid ${COLORS.BORDER_LIGHTER};

  @media (max-width: ${BREAKPOINTS.DESKTOP}) {
    padding: 14px;
  }
`
