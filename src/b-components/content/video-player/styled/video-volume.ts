// @ts-expect-error vue3-styled-components types
import styled from 'vue3-styled-components'

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
  transition: background-color 0.2s ease;
  color: var(--color-text-primary);
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  box-sizing: border-box;
  position: relative;

  @media (max-width: 768px) {
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
    border-radius: 1px;
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
    border-radius: 1px;
  }
`

export const SC_VideoVolumeSlider = styled.div`
  width: 80px;
  min-width: 80px;
  height: 6px;
  min-height: 6px;
  max-height: 6px;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: var(--ui-radius-xs);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition:
    height 0.15s ease,
    background-color 0.15s ease;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
  margin: 0;
  padding: 0;
  display: block;
  align-self: center;
  box-sizing: border-box;

  &:hover {
    height: 8px;
    min-height: 8px;
    max-height: 8px;
    background-color: rgba(0, 0, 0, 0.4);
  }

  /* На мобилке скрываем slider — только mute-кнопка остаётся.
     Регулировка громкости делается hardware-кнопками девайса. */
  @media (max-width: 768px) {
    display: none;
  }
`

export const SC_VideoVolumeFill = styled.div<{ isDragging?: boolean }>`
  height: 100%;
  width: 0%;
  background-color: #333;
  background: linear-gradient(90deg, #333 0%, #555 100%);
  border-radius: var(--ui-radius-xs);
  transition: ${(p) => (p.isDragging ? 'none' : 'width 0.1s linear')};
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: auto;
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
  background: rgba(180, 180, 180, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 12px 24px;
  border-radius: var(--ui-radius-lg);
  color: #eee;
  font-size: 18px;
  font-weight: 500;
  font-family: var(--font-family);
  white-space: nowrap;
  user-select: none;
  pointer-events: none;
  opacity: ${(p) => (p.show ? 1 : 0)};
  visibility: ${(p) => (p.show ? 'visible' : 'hidden')};
  transition:
    opacity 0.2s ease,
    visibility 0.2s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
`
