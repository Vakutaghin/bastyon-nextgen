import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_MessengerWrapper = styled.div`
  position: fixed;
  bottom: 14px;
  right: 14px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  pointer-events: none;
`

export const SC_BackButton = styled.button`
  background: none;
  border: none;
  color: var(--ui-text-muted);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--ui-radius-md);

  &:hover {
    color: var(--ui-text-highlighted);
    background-color: var(--ui-bg-elevated);
  }

  svg {
    width: 20px;
    height: 20px;
    display: block;
  }
`

/**
 * Полноэкранный мессенджер: перекрывает ВЕСЬ экран, включая хедер (inset:0,
 * z-index выше хедера=1000). Крестик закрытия живёт внутри окна (см. ниже),
 * т.к. иконка в хедере оказывается под оверлеем.
 */
export const SC_FullScreenOverlay = styled.div`
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100vh;
  z-index: 2500;
  background-color: var(--color-bg-primary);
  display: flex;
  flex-direction: column;
  padding: var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left);
`

/**
 * Крестик закрытия внутри окна мессенджера — плавающая круглая кнопка в правом
 * верхнем углу оверлея (там, где раньше был хедер). Учитывает safe-area.
 */
export const SC_CloseOverlayButton = styled.button`
  position: absolute;
  top: calc(var(--safe-top) + 10px);
  right: calc(var(--safe-right) + 14px);
  z-index: 10;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--color-bg-tertiary);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  transition:
    color var(--transition-fast),
    background-color var(--transition-fast);

  &:hover {
    color: var(--color-text-primary);
    background-color: var(--color-overlay-6);
  }

  svg {
    width: 20px;
    height: 20px;
  }
`

export const SC_OverlayContent = styled.div`
  flex: 1;
  overflow: hidden;
  padding: 20px;
  width: 100%;
  margin: 0 auto;
  max-width: var(--content-max-width);

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    padding: 0;
  }
`

export const SC_MessengerWrapperLoader = styled.div`
  flex: 1;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--ui-text-dimmed);
  font-size: 14px;
`

export const SC_MessengerWrapperSpinner = styled.span`
  display: inline-block;
  width: 32px;
  height: 32px;
  border: 3px solid var(--ui-border);
  border-top-color: var(--color-text-secondary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite; /* @keyframes spin — глобально в style.css */
`

export const SC_MessengerWrapperLoaderText = styled.span`
  margin: 0;
`
