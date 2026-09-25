import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_MessengerContainer = styled.div`
  flex: 1;
  display: flex;
  background: var(--color-bg-primary);
  border-radius: var(--ui-radius-lg);
  border: 1px solid var(--ui-border);
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
  border-right: 1px solid var(--ui-border);
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);

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
  background: var(--color-bg-primary);
  position: relative;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    display: ${(props) => (props.isActive ? 'flex' : 'none')};
    width: 100%;
  }
`

/** Шапка сайдбара со списком чатов. */
export const SC_SidebarHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid var(--ui-border);
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
`

/** Красная плашка с ошибкой синка messenger. */
export const SC_SyncErrorBanner = styled.div`
  padding: 8px;
  background: var(--color-red-bg);
  color: var(--color-red-dark);
  font-size: 12px;
`

/** Синяя плашка со статусом синка messenger. */
export const SC_SyncStatusBanner = styled.div`
  padding: 8px;
  background: rgb(var(--ui-primary-rgb) / 10%);
  color: var(--color-primary-dark);
  font-size: 12px;
`

/** Верхняя панель в активном чате (back-button + имя собеседника). */
export const SC_ChatTopBar = styled.div`
  height: 56px;
  border-bottom: 1px solid var(--ui-border);
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
  color: var(--ui-text-dimmed);
  font-size: 16px;
  flex-direction: column;
  gap: 16px;

  svg {
    width: 64px;
    height: 64px;
    color: var(--ui-text-dimmed);
    stroke-width: 1.5;
  }
`

export const SC_MobileBackButton = styled.button`
  margin-right: 12px;
  background: none;
  border: none;
  color: var(--ui-text);
  font-size: 24px;
  cursor: pointer;
  display: none;
  transition: color var(--transition-quick);

  &:hover {
    color: var(--ui-text-highlighted);
  }

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
  color: var(--ui-text-dimmed);
  font-size: 14px;
`

export const SC_MessengerDialogsSpinner = styled.span`
  display: inline-block;
  width: 32px;
  height: 32px;
  border: 3px solid var(--ui-border);
  border-top-color: var(--color-text-secondary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite; /* @keyframes spin — глобально в style.css */
`

export const SC_MessengerDialogsLoaderText = styled.span`
  margin: 0;
`
