// @ts-expect-error vue3-styled-components types
import styled from 'vue3-styled-components'

export const SC_VideoVolumeControl = styled.div`
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 8px !important;
  flex-shrink: 0 !important;
  position: relative !important;
`

export const SC_VideoVolumeButton = styled.button`
  background: transparent !important;
  border: none !important;
  cursor: pointer !important;
  padding: 8px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 4px !important;
  transition: background-color 0.2s ease !important;
  color: #333 !important;
  flex-shrink: 0 !important;
  width: 32px !important;
  height: 32px !important;
  min-width: 32px !important;
  min-height: 32px !important;
  box-sizing: border-box !important;
  position: relative !important;

  @media (max-width: 768px) {
    width: 44px !important;
    height: 44px !important;
    min-width: 44px !important;
    min-height: 44px !important;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.1) !important;
  }

  &:active {
    background: rgba(0, 0, 0, 0.15) !important;
  }

  &:focus {
    outline: none !important;
  }
`

export const SC_VideoVolumeMutedIcon = styled.div`
  position: relative !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 100% !important;
  height: 100% !important;
`

export const SC_VideoVolumeMutedCross = styled.div`
  position: absolute !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  width: 16px !important;
  height: 16px !important;
  z-index: 1 !important;
  pointer-events: none !important;

  &::before {
    content: '' !important;
    position: absolute !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) rotate(45deg) !important;
    width: 2px !important;
    height: 14px !important;
    background-color: #999 !important;
    border-radius: 1px !important;
  }

  &::after {
    content: '' !important;
    position: absolute !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) rotate(45deg) !important;
    width: 14px !important;
    height: 2px !important;
    background-color: #999 !important;
    border-radius: 1px !important;
  }
`

export const SC_VideoVolumeSlider = styled.div`
  width: 80px !important;
  min-width: 80px !important;
  height: 6px !important;
  min-height: 6px !important;
  max-height: 6px !important;
  background-color: rgba(0, 0, 0, 0.3) !important;
  border-radius: 3px !important;
  cursor: pointer !important;
  position: relative !important;
  overflow: hidden !important;
  transition:
    height 0.15s ease,
    background-color 0.15s ease !important;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2) !important;
  margin: 0 !important;
  padding: 0 !important;
  display: block !important;
  align-self: center !important;
  box-sizing: border-box !important;

  &:hover {
    height: 8px !important;
    min-height: 8px !important;
    max-height: 8px !important;
    background-color: rgba(0, 0, 0, 0.4) !important;
  }

  /* На мобилке скрываем slider — только mute-кнопка остаётся.
     Регулировка громкости делается hardware-кнопками девайса. */
  @media (max-width: 768px) {
    display: none !important;
  }
`

export const SC_VideoVolumeFill = styled.div<{ isDragging?: boolean }>`
  height: 100% !important;
  width: 0%;
  background-color: #333 !important;
  background: linear-gradient(90deg, #333 0%, #555 100%) !important;
  border-radius: 3px !important;
  transition: ${(p) => (p.isDragging ? 'none' : 'width 0.1s linear')} !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  bottom: 0 !important;
  right: auto !important;
  display: block !important;
  pointer-events: none !important;
  box-sizing: border-box !important;
  z-index: 2 !important;
  min-width: 0 !important;
  opacity: 1 !important;
  visibility: visible !important;
  will-change: width !important;
`

export const SC_VolumeNotification = styled.div<{ show?: boolean }>`
  position: absolute !important;
  top: 25% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  z-index: 100 !important;
  background: rgba(180, 180, 180, 0.6) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  padding: 12px 24px !important;
  border-radius: 8px !important;
  color: #eee !important;
  font-size: 18px !important;
  font-weight: 500 !important;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
  white-space: nowrap !important;
  user-select: none !important;
  pointer-events: none !important;
  opacity: ${(p) => (p.show ? 1 : 0)} !important;
  visibility: ${(p) => (p.show ? 'visible' : 'hidden')} !important;
  transition:
    opacity 0.2s ease,
    visibility 0.2s ease !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
`
