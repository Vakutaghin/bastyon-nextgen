// @ts-expect-error vue3-styled-components types
import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_VideoVolumeControl = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  flex-shrink: 0;
  position: relative;
`

export const SC_VideoVolumeButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--ui-radius-sm);
  transition: background-color var(--transition-fast);
  color: var(--color-text-primary);
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  box-sizing: border-box;
  position: relative;

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
  }

  &:hover {
    background: var(--color-overlay-8);
  }

  &:active {
    background: var(--color-overlay-12);
  }

  &:focus {
    outline: none;
  }
`

export const SC_VideoVolumeMutedIcon = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
`

export const SC_VideoVolumeMutedCross = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 16px;
  height: 16px;
  z-index: 1;
  pointer-events: none;

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(45deg);
    width: 2px;
    height: 14px;
    background-color: var(--color-text-muted);
    border-radius: var(--ui-radius-xs);
  }

  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(45deg);
    width: 14px;
    height: 2px;
    background-color: var(--color-text-muted);
    border-radius: var(--ui-radius-xs);
  }
`

export const SC_VideoVolumeSlider = styled.div`
  width: 80px;
  min-width: 80px;
  height: 6px;
  min-height: 6px;
  max-height: 6px;
  background-color: var(--color-overlay-20);
  border-radius: var(--ui-radius-xs);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition:
    height var(--transition-quick),
    background-color var(--transition-quick);
  box-shadow: inset 0 1px 2px rgb(var(--color-black-rgb) / 20%);
  margin: 0;
  padding: 0;
  display: block;
  align-self: center;
  box-sizing: border-box;

  &:hover {
    height: 8px;
    min-height: 8px;
    max-height: 8px;
    background-color: var(--color-overlay-30);
  }

  /* На мобилке скрываем slider — только mute-кнопка остаётся.
     Регулировка громкости делается hardware-кнопками девайса. */
  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    display: none;
  }
`

export const SC_VideoVolumeFill = styled.div<{ isDragging?: boolean }>`
  height: 100%;
  width: 0%;
  background: var(--ui-primary-on-dark);
  border-radius: var(--ui-radius-xs);
  transition: ${(p) => (p.isDragging ? 'none' : 'width 0.1s linear')};
  position: absolute;
  inset: 0 auto 0 0;
  display: block;
  pointer-events: none;
  box-sizing: border-box;
  z-index: 2;
  min-width: 0;
  opacity: 1;
  visibility: visible;
  will-change: width;
`

export const SC_VolumeNotification = styled.div<{ show?: boolean }>`
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
