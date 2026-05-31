import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'
import { COLORS } from '@/styles/theme-colors'

export const SC_MessengerContainer = styled.div`
  flex: 1;
  display: flex;
  background: ${COLORS.BG_PRIMARY};
  border-radius: 8px;
  border: 1px solid ${COLORS.GRAY_EEE};
  overflow: hidden;

  /* Remove margin here, let parent control it */

  /* margin: 20px 0; */
  height: 100%;
`

const sidebarProps = {
  isHidden: Boolean,
}

export const SC_SidebarColumn = styled('div', sidebarProps)`
  width: 320px;
  border-right: 1px solid ${COLORS.GRAY_EEE};
  display: flex;
  flex-direction: column;
  background: ${COLORS.BG_PRIMARY};

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    width: 100%;
    display: ${(props) => (props.isHidden ? 'none' : 'flex')};
  }
`

const chatProps = {
  isActive: Boolean,
}

export const SC_ChatColumn = styled('div', chatProps)`
  flex: 1;
  display: flex;
  flex-direction: column;
  background: ${COLORS.BG_PRIMARY};
  position: relative;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    display: ${(props) => (props.isActive ? 'flex' : 'none')};
    width: 100%;
  }
`

/** Шапка сайдбара со списком чатов. */
export const SC_SidebarHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid ${COLORS.GRAY_EEE};
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: space-between;
`

/** Красная плашка с ошибкой синка messenger. */
export const SC_SyncErrorBanner = styled.div`
  padding: 8px;
  background: ${COLORS.RED_BG};
  color: ${COLORS.RED_DARK};
  font-size: 12px;
`

/** Синяя плашка со статусом синка messenger. */
export const SC_SyncStatusBanner = styled.div`
  padding: 8px;
  background: ${COLORS.ANT_BLUE_BG};
  color: ${COLORS.PRIMARY_DARK};
  font-size: 12px;
`

/** Верхняя панель в активном чате (back-button + имя собеседника). */
export const SC_ChatTopBar = styled.div`
  height: 56px;
  border-bottom: 1px solid ${COLORS.GRAY_EEE};
  display: flex;
  align-items: center;
  padding: 0 16px;
`

/** Имя собеседника в шапке активного чата. */
export const SC_PartnerName = styled.span`
  font-weight: 600;
`

export const SC_EmptyState = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${COLORS.GRAY_999};
  font-size: 16px;
  flex-direction: column;
  gap: 16px;

  svg {
    width: 64px;
    height: 64px;
    fill: ${COLORS.GRAY_EEE};
  }
`

export const SC_MobileBackButton = styled.button`
  margin-right: 12px;
  background: none;
  border: none;
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 0;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    display: flex;
  }
`

export const SC_MessengerDialogsLoader = styled.div`
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: ${COLORS.GRAY_888};
  font-size: 14px;
`

export const SC_MessengerDialogsSpinner = styled.span`
  display: inline-block;
  width: 32px;
  height: 32px;
  border: 3px solid ${COLORS.GRAY_E0};
  border-top-color: ${COLORS.TEXT_SECONDARY};
  border-radius: 50%;
  animation: spin 0.8s linear infinite; /* @keyframes spin — глобально в style.css */
`

export const SC_MessengerDialogsLoaderText = styled.span`
  margin: 0;
`
