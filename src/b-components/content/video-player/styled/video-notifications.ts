// @ts-expect-error vue3-styled-components types
import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_PlaybackRateNotification = styled.div<{ show?: boolean }>`
  position: absolute;
  top: 25%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 100;
  background: rgb(var(--color-black-rgb) / 50%);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 12px 24px;
  border-radius: var(--ui-radius-lg);
  color: var(--color-white);
  font-size: 18px;
  font-weight: 500;
  font-family: var(--font-family);
  white-space: nowrap;
  user-select: none;
  pointer-events: none;
  opacity: ${(p) => (p.show ? 1 : 0)};
  visibility: ${(p) => (p.show ? 'visible' : 'hidden')};
  transition:
    opacity var(--transition-fast),
    visibility var(--transition-fast);
  box-shadow: 0 4px 12px rgb(var(--color-black-rgb) / 30%);
`

export const SC_SeekNotification = styled.div<{ show?: boolean }>`
  position: absolute;
  top: 25%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 100;
  background: rgb(var(--color-black-rgb) / 50%);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 12px 24px;
  border-radius: var(--ui-radius-lg);
  color: var(--color-white);
  font-size: 18px;
  font-weight: 500;
  font-family: var(--font-family);
  white-space: nowrap;
  user-select: none;
  pointer-events: none;
  opacity: ${(p) => (p.show ? 1 : 0)};
  visibility: ${(p) => (p.show ? 'visible' : 'hidden')};
  transition:
    opacity var(--transition-fast),
    visibility var(--transition-fast);
  box-shadow: 0 4px 12px rgb(var(--color-black-rgb) / 30%);
`

export const SC_IconNotification = styled.div<{ show?: boolean }>`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 100;
  background: rgb(var(--color-black-rgb) / 50%);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  padding: 20px;
  border-radius: 50%;
  color: var(--color-white);
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  pointer-events: none;
  opacity: ${(p) => (p.show ? 1 : 0)};
  visibility: ${(p) => (p.show ? 'visible' : 'hidden')};
  transition:
    opacity var(--transition-fast),
    visibility var(--transition-fast);
  box-shadow: 0 4px 12px rgb(var(--color-black-rgb) / 30%);
`

export const SC_HotkeysHelpOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgb(var(--color-black-rgb) / 85%);
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  padding: 20px;
  box-sizing: border-box;
`

export const SC_HotkeysHelpContent = styled.div`
  background: var(--ui-bg);
  border-radius: var(--ui-radius-lg);
  padding: 24px;
  max-width: 600px;
  width: 90%;
  max-height: 90%;
  overflow-y: auto;
  position: relative;
  box-shadow:
    0 0 0 1px var(--ui-border),
    var(--ui-shadow-lg);
`

export const SC_HotkeysHelpTitle = styled.h3`
  margin: 0 0 20px;
  font-size: 20px;
  font-weight: 600;
  text-align: center;
  color: var(--ui-text-highlighted);
`

export const SC_HotkeysHelpList = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;

  @media (min-width: ${() => BREAKPOINTS.MOBILE}) {
    grid-template-columns: 1fr 1fr;
    gap: 12px 24px;
  }
`

export const SC_HotkeysHelpItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--ui-border);

  &:last-child {
    border-bottom: none;
  }
`

export const SC_HotkeysKey = styled.span`
  background: var(--ui-bg);
  padding: 4px 8px;
  border-radius: var(--ui-radius-sm);
  font-family: var(--font-family-mono);
  font-size: 16px;
  font-weight: 500;
  white-space: nowrap;
  color: var(--ui-text-highlighted);
  box-shadow: inset 0 0 0 1px var(--ui-border-accented);
`

export const SC_HotkeysDescription = styled.span`
  font-size: 16px;
  color: var(--ui-text);
  text-align: right;
  margin-left: 10px;
`

export const SC_HotkeysCloseButton = styled.button`
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  border-radius: var(--ui-radius-md);
  color: var(--ui-text-dimmed);
  cursor: pointer;
  padding: 4px;
  transition:
    color var(--transition-quick),
    background-color var(--transition-quick);

  &:hover {
    color: var(--ui-text);
    background: var(--ui-bg-elevated);
  }
`
