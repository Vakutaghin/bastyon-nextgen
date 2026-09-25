import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_WalletWork = styled.div`
  display: flex;
  flex: 1;
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - var(--header-height));
  padding: 0 0 25px;
  align-items: flex-start;
  background: ${COLORS.BG_PRIMARY};
`

export const SC_WalletPage = styled.main`
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  padding: 60px 20px 24px;
`

export const SC_WalletTitle = styled.h1`
  font-size: 22px;
  font-weight: 600;
  color: ${COLORS.GRAY_212};
  margin: 24px 0;
`

export const SC_WalletTabs = styled.div`
  margin-top: 8px;
`

export const SC_WalletTabList = styled.nav`
  display: flex;
  gap: 0;
  border-bottom: 1px solid ${COLORS.OVERLAY_12};
  margin-bottom: 20px;
`

export const SC_WalletTabButton = styled.button`
  font-size: 14px;
  font-weight: 500;
  color: ${COLORS.GRAY_120};
  background: none;
  border: none;
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;

  &:hover {
    color: ${COLORS.GRAY_212};
  }

  &.active {
    color: ${COLORS.PRIMARY};
    border-bottom-color: ${COLORS.PRIMARY};
  }
`

export const SC_WalletTabPanels = styled.div`
  min-height: 200px;
`

export const SC_WalletTabPanel = styled.div`
  display: none;

  &.active {
    display: block;
  }
`

export const SC_BuyHelp = styled.div`
  margin-top: 16px;
  text-align: center;
  font-size: 14px;
  color: ${COLORS.TEXT_SECONDARY};

  a {
    color: ${COLORS.PRIMARY};
    text-decoration: none;
    transition: color ${TRANSITIONS.FAST};
  }

  a:hover {
    text-decoration: underline;
  }
`
