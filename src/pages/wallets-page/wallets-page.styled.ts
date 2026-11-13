import styled from 'vue3-styled-components'
import { BREAKPOINTS, TRANSITIONS } from '@/styles/design-tokens'

export const SC_WalletWork = styled.div`
  display: flex;
  flex: 1;
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - var(--header-height));
  padding: 0 0 25px;
  align-items: flex-start;
  background: var(--color-bg-primary);
`

export const SC_WalletPage = styled.main`
  width: 100%;
  max-width: var(--content-max-width);
  margin: 0 auto;
  /* От шапки вместе со строкой состояния: с 60px заголовок на телефоне
     уходил под шапку. */
  padding: var(--header-height-total) var(--content-padding-x) 24px;
`

export const SC_WalletTitle = styled.h1`
  font-size: 24px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  margin: 24px 0;

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    font-size: 20px;
    margin: 16px 0;
  }
`

export const SC_WalletTabs = styled.div`
  margin-top: 8px;
`

/* Пять вкладок на телефоне не помещаются: ряд прокручивается вбок, страница
   не шире экрана. Линия под рядом — тенью: рамка с margin-bottom: -1px у
   кнопок при overflow-x давала бы вертикальную прокрутку. */
export const SC_WalletTabList = styled.nav`
  display: flex;
  gap: 0;
  overflow-x: auto;
  scrollbar-width: none;
  box-shadow: inset 0 -1px 0 var(--color-overlay-12);
  margin-bottom: 20px;

  &::-webkit-scrollbar {
    display: none;
  }
`

export const SC_WalletTabButton = styled.button`
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text-muted);
  background: none;
  border: none;
  flex: 0 0 auto;
  white-space: nowrap;
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 2px solid transparent;

  &:hover {
    color: var(--ui-text-highlighted);
  }

  &.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
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
  color: var(--color-text-secondary);

  a {
    color: var(--color-primary);
    text-decoration: none;
    transition: color ${TRANSITIONS.FAST};
  }

  a:hover {
    text-decoration: underline;
  }
`
