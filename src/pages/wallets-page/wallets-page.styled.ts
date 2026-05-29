import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_WalletWork = styled.div`
  display: flex;
  flex: 1;
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - 60px);
  padding: 0 0 25px;
  align-items: flex-start;
  background: ${COLORS.WHITE};
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

export const SC_WalletBalanceCards = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 28px;
`

export const SC_WalletBalanceCard = styled.div`
  padding: 16px 20px;
  background: ${COLORS.BG_LIGHT};
  border-radius: 10px;
  border: 1px solid ${COLORS.OVERLAY_6};
  width: 33%;
`

export const SC_WalletBalanceLabel = styled.div`
  font-size: 13px;
  color: ${COLORS.GRAY_120};
  margin-bottom: 4px;
`

export const SC_WalletBalanceValue = styled.div`
  font-size: 20px;
  font-weight: 600;
  color: ${COLORS.GRAY_212};
`

export const SC_WalletTableSection = styled.section`
  margin-top: 8px;
`

export const SC_WalletTableSectionSecondary = styled.section`
  margin-top: 24px;
`

export const SC_WalletTableTitleRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 0 12px;
  gap: 12px;
`

export const SC_WalletTableTitle = styled.h2`
  font-size: 16px;
  font-weight: 600;
  color: ${COLORS.GRAY_212};
  margin: 10px;
`

export const SC_WalletAddButton = styled.button`
  font-size: 14px;
  font-weight: 500;
  color: ${COLORS.GRAY_212};
  background: ${COLORS.BG_LIGHT};
  border: 1px solid ${COLORS.OVERLAY_12};
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: ${COLORS.BG_HOVER};
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

export const SC_WalletTable = styled.div`
  border: 1px solid ${COLORS.OVERLAY_8};
  border-radius: 10px;
  overflow: hidden;
`

export const SC_WalletTableRow = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  align-items: center;
  padding: 12px 16px;
  font-size: 14px;
  border-bottom: 1px solid ${COLORS.OVERLAY_6};
  background: ${COLORS.WHITE};

  &:last-child {
    border-bottom: none;
  }
`

export const SC_WalletTableHeader = styled(SC_WalletTableRow)`
  background: ${COLORS.BG_LIGHT};
  font-weight: 600;
  color: ${COLORS.GRAY_212};
`

export const SC_WalletTableAddress = styled.span`
  font-family: ui-monospace, monospace;
  font-size: 13px;
  color: ${COLORS.GRAY_212};
  word-break: break-all;
`

export const SC_WalletAddressCell = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`

export const SC_WalletExplorerLink = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: ${COLORS.GRAY_120};
  cursor: pointer;
  border-radius: 4px;
  flex-shrink: 0;
  transition:
    color ${TRANSITIONS.QUICK},
    background-color ${TRANSITIONS.QUICK};
  text-decoration: none;

  &:hover {
    color: ${COLORS.PRIMARY};
    background: ${COLORS.PRIMARY_BG_SOFT};
  }
`

export const SC_WalletTableBalance = styled.span`
  font-weight: 500;
  color: ${COLORS.GRAY_212};
`

export const SC_WalletLoading = styled.div`
  padding: 40px 0;
  text-align: center;
  font-size: 15px;
  color: ${COLORS.GRAY_120};
`

export const SC_WalletError = styled.div`
  padding: 24px;
  background: ${COLORS.DANGER_BG_SOFT};
  border-radius: 10px;
  font-size: 14px;
  color: ${COLORS.DANGER_DEEP};
`

export const SC_WalletTabPlaceholder = styled.div`
  padding: 40px 0;
  text-align: center;
  font-size: 14px;
  color: ${COLORS.GRAY_120};
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
