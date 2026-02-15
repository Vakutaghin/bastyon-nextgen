import styled from 'vue3-styled-components'

export const SC_WalletWork = styled.div`
  display: flex;
  flex: 1;
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - 60px);
  padding: 0 0 25px;
  align-items: flex-start;
  background: rgb(255, 255, 255);
`

export const SC_WalletPage = styled.div`
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  padding: 60px 20px 24px;
`

export const SC_WalletTitle = styled.h1`
  font-size: 22px;
  font-weight: 600;
  color: rgb(33, 33, 33);
  margin: 24px 0;
`

export const SC_WalletBalanceCards = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 28px;
`

export const SC_WalletBalanceCard = styled.div`
  padding: 16px 20px;
  background: rgb(249, 249, 249);
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  width: 33%;
`

export const SC_WalletBalanceLabel = styled.div`
  font-size: 13px;
  color: rgb(120, 120, 120);
  margin-bottom: 4px;
`

export const SC_WalletBalanceValue = styled.div`
  font-size: 20px;
  font-weight: 600;
  color: rgb(33, 33, 33);
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
  color: rgb(33, 33, 33);
  margin: 10px;
`

export const SC_WalletAddButton = styled.button`
  font-size: 14px;
  font-weight: 500;
  color: rgb(33, 33, 33);
  background: rgb(249, 249, 249);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: rgb(240, 240, 240);
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`

export const SC_WalletTable = styled.div`
  border: 1px solid rgba(0, 0, 0, 0.08);
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
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  background: rgb(255, 255, 255);

  &:last-child {
    border-bottom: none;
  }
`

export const SC_WalletTableHeader = styled(SC_WalletTableRow)`
  background: rgb(249, 249, 249);
  font-weight: 600;
  color: rgb(33, 33, 33);
`

export const SC_WalletTableAddress = styled.span`
  font-family: ui-monospace, monospace;
  font-size: 13px;
  color: rgb(33, 33, 33);
  word-break: break-all;
`

export const SC_WalletTableBalance = styled.span`
  font-weight: 500;
  color: rgb(33, 33, 33);
`

export const SC_WalletLoading = styled.div`
  padding: 40px 0;
  text-align: center;
  font-size: 15px;
  color: rgb(120, 120, 120);
`

export const SC_WalletError = styled.div`
  padding: 24px;
  background: rgba(220, 53, 69, 0.08);
  border-radius: 10px;
  font-size: 14px;
  color: rgb(180, 50, 50);
`

export const SC_WalletTabPlaceholder = styled.div`
  padding: 40px 0;
  text-align: center;
  font-size: 14px;
  color: rgb(120, 120, 120);
`

export const SC_WalletTabs = styled.div`
  margin-top: 8px;
`

export const SC_WalletTabList = styled.nav`
  display: flex;
  gap: 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  margin-bottom: 20px;
`

export const SC_WalletTabButton = styled.button`
  font-size: 14px;
  font-weight: 500;
  color: rgb(120, 120, 120);
  background: none;
  border: none;
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;

  &:hover {
    color: rgb(33, 33, 33);
  }

  &.active {
    color: rgb(22, 119, 255);
    border-bottom-color: rgb(22, 119, 255);
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
