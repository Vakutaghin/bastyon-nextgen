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

  &.with-bottom-nav {
    padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px));
  }
`

export const SC_Work = styled.div`
  display: flex;
  flex: 1;
  max-width: 1600px;
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - 60px);
  gap: 20px;
  padding: 58px 0 25px;
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
    padding: 16px 10px 20px;
  }
`

export const SC_SidebarRight = styled.div`
  width: 320px;
  flex-shrink: 0;
  position: sticky;
  top: 85px;
  height: fit-content;
  max-height: calc(100vh - 100px);
  background: ${COLORS.BG_PRIMARY};
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid ${COLORS.BORDER_LIGHTER};
`
