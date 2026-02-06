// @ts-ignore
import styled, { keyframes } from 'vue3-styled-components'

const shimmer = keyframes`
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
`

export const SC_VideoSkeleton = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 3;
  background: linear-gradient(90deg, #f2f2f2 25%, #e6e6e6 37%, #f2f2f2 63%);
  background-size: 400% 100%;
  animation: ${shimmer} 1.4s ease infinite;
`

export const SC_VideoContainer = styled.div`
  position: relative !important;
  width: 100% !important;
  max-width: 100% !important;
  background-color: #f2f2f2 !important;
  border-radius: 8px !important;
  overflow: hidden !important;
  margin-bottom: 15px !important;
  aspect-ratio: 16 / 9 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  cursor: pointer !important;
  z-index: 0 !important;
  user-select: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;

  &:fullscreen {
    width: 100vw;
    height: 100vh;
    border-radius: 0;
    aspect-ratio: unset;
  }

  &:-webkit-full-screen {
    width: 100vw;
    height: 100vh;
    border-radius: 0;
    aspect-ratio: unset;
  }

  &:-moz-full-screen {
    width: 100vw;
    height: 100vh;
    border-radius: 0;
    aspect-ratio: unset;
  }

  &:-ms-fullscreen {
    width: 100vw;
    height: 100vh;
    border-radius: 0;
    aspect-ratio: unset;
  }

  &.is-fullscreen {
    position: fixed !important;
    top: 0;
    left: 0;
    width: 100vw !important;
    height: 100vh !important;
    border-radius: 0 !important;
    aspect-ratio: unset !important;
    z-index: 2147483647 !important;
    background: black !important;
  }

  /* Скрытие курсора в полноэкранном режиме, когда тулбар скрыт */
  &.hide-cursor {
    cursor: none !important;
  }

`

export const SC_VideoWrapper = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
`

export const SC_VideoElement = styled.video`
  width: 100%;
  height: 100%;
  /* object-fit управляется динамически через inline стили или остается contain по умолчанию */
  object-fit: contain;
  display: block;
`

export const SC_VideoThumbnail = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  z-index: 2;
  pointer-events: none;
  transition: opacity 0.3s ease;
  background-color: #f2f2f2;
`

// Объявляем SC_VideoControls после SC_VideoContainer, но используем другой подход для hover
export const SC_VideoControls = styled.div<{ show?: boolean }>`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 10;
  opacity: ${(p) => (p.show !== undefined && p.show ? 1 : 0)};
  visibility: ${(p) => (p.show !== undefined && p.show ? 'visible' : 'hidden')};
  transition: opacity 0.3s ease, visibility 0.3s ease;
  pointer-events: ${(p) => (p.show !== undefined && p.show ? 'auto' : 'none')};
  /* Убеждаемся, что контролы не влияют на layout - абсолютное позиционирование выводит из потока */
  height: auto;
  width: 100%;
  box-sizing: border-box;
  /* Важно: не должно быть margin/padding, которые могут влиять на размеры */
  margin: 0;
  padding: 0;
`

export const SC_VideoControlsBar = styled.div`
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 12px !important;
  padding: 10px 14px !important;
  background: rgba(255, 255, 255, 0.6) !important;
  backdrop-filter: blur(10px) !important;
  -webkit-backdrop-filter: blur(10px) !important;
  position: relative !important;
  width: 100% !important;
  box-sizing: border-box !important;
  flex-shrink: 0 !important;
  min-height: 50px !important;
  height: 50px !important;
  pointer-events: auto !important;
`

export const SC_VideoPlayPauseButton = styled.button`
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
  width: 40px !important;
  height: 40px !important;
  min-width: 40px !important;
  min-height: 40px !important;
  box-sizing: border-box !important;

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

export const SC_VideoPlayButton = styled.button`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.3);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 10;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);

  svg {
    color: #888 !important;
    fill: #888 !important;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.4);
    transform: translate(-50%, -50%) scale(1.15);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
  }

  &:active {
    transform: translate(-50%, -50%) scale(1.05);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  }
`

export const SC_VideoTimeDisplay = styled.span`
  color: #333 !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  user-select: none !important;
  flex-shrink: 0 !important;
  min-width: 100px !important;
  text-align: center !important;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
  white-space: nowrap !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 4px !important;
  box-sizing: border-box !important;
`

export const SC_VideoProgressBar = styled.div`
  flex: 1 1 0 !important;
  min-width: 0 !important;
  width: 100% !important;
  height: 6px !important;
  min-height: 6px !important;
  max-height: 6px !important;
  background-color: rgba(0, 0, 0, 0.3) !important;
  border-radius: 3px !important;
  cursor: pointer !important;
  position: relative !important;
  overflow: hidden !important;
  transition: height 0.15s ease, background-color 0.15s ease !important;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2) !important;
  margin: 0 !important;
  padding: 0 !important;
  display: block !important;
  align-self: center !important;
  box-sizing: border-box !important;

  > * {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    height: 100% !important;
  }

  &:hover {
    height: 8px !important;
    min-height: 8px !important;
    max-height: 8px !important;
    background-color: rgba(0, 0, 0, 0.4) !important;

    /* Применяем красный цвет только к полоске прогресса, исключая первый дочерний элемент (полоску загрузки) */
    > *:not(:first-child) {
      background: linear-gradient(90deg, #ff3333 0%, #ff0000 100%) !important;
      box-shadow: 0 0 6px rgba(255, 0, 0, 0.5) !important;
    }
  }

`

export const SC_VideoProgressFill = styled.div`
  height: 100% !important;
  width: 0%;
  background-color: #ff0000 !important;
  background: linear-gradient(90deg, #ff0000 0%, #cc0000 100%) !important;
  border-radius: 3px !important;
  transition: background 0.15s ease, box-shadow 0.15s ease !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  bottom: 0 !important;
  right: auto !important;
  box-shadow: 0 0 4px rgba(255, 0, 0, 0.4) !important;
  display: block !important;
  pointer-events: none !important;
  box-sizing: border-box !important;
  z-index: 2 !important;
  min-width: 0 !important;
  opacity: 1 !important;
  visibility: visible !important;
  will-change: width !important;
`

export const SC_VideoBufferFill = styled.div`
  height: 100% !important;
  width: 0%;
  background-color: rgba(100, 150, 255, 0.5) !important;
  background: linear-gradient(90deg, rgba(120, 170, 255, 0.6) 0%, rgba(80, 130, 255, 0.4) 100%) !important;
  border-radius: 3px !important;
  transition: width 0.2s ease !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  bottom: 0 !important;
  right: auto !important;
  display: block !important;
  pointer-events: none !important;
  box-sizing: border-box !important;
  z-index: 1 !important;
  opacity: 1 !important;
  visibility: visible !important;
  min-width: 0 !important;
  will-change: width !important;
`

export const SC_VideoLoading = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
`

export const SC_VideoError = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  background-color: rgba(0, 0, 0, 0.8);
  color: white !important;
  padding: 20px 30px;
  border-radius: 8px;
  text-align: center;

  p {
    margin: 0;
    font-size: 16px;
    color: white !important;
  }
`

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
  transition: height 0.15s ease, background-color 0.15s ease !important;
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

export const SC_VideoQualityControl = styled.div`
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 0 !important;
  flex-shrink: 0 !important;
  position: relative !important;
`

export const SC_VideoQualityButton = styled.button`
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
  width: 40px !important;
  height: 40px !important;
  min-width: 40px !important;
  min-height: 40px !important;
  box-sizing: border-box !important;
  position: relative !important;

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

export const SC_VideoQualityDropdown = styled.div<{
  isOpen?: boolean
}>`
  position: absolute !important;
  bottom: 100% !important;
  left: 0 !important;
  margin-bottom: 8px !important;
  background: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(10px) !important;
  -webkit-backdrop-filter: blur(10px) !important;
  border-radius: 8px !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
  min-width: 140px !important;
  overflow: visible !important;
  opacity: ${(p) => (p.isOpen ? 1 : 0)} !important;
  visibility: ${(p) => (p.isOpen ? 'visible' : 'hidden')} !important;
  pointer-events: ${(p) => (p.isOpen ? 'auto' : 'none')} !important;
  transition: opacity 0.2s ease, visibility 0.2s ease !important;
  z-index: 1000 !important;
`

export const SC_VideoQualityMenuSection = styled.div`
  padding: 0 !important;
`

export const SC_VideoQualityMenuSectionTitle = styled.div`
  padding: 0 !important;
`

export const SC_VideoQualitySubmenuItem = styled.button<{ isOpen?: boolean }>`
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  width: 100% !important;
  padding: 6px 12px !important;
  background: transparent !important;
  border: none !important;
  cursor: pointer !important;
  color: #333 !important;
  font-size: 12px !important;
  font-weight: 400 !important;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
  transition: background-color 0.15s ease !important;
  text-align: left !important;
  box-sizing: border-box !important;
  position: relative !important;

  &:hover {
    background: rgba(0, 0, 0, 0.08) !important;
  }

  &:active {
    background: rgba(0, 0, 0, 0.12) !important;
  }

  &:focus {
    outline: none !important;
  }

  &:not(:last-child) {
    border-bottom: 1px solid rgba(0, 0, 0, 0.05) !important;
  }
`

export const SC_VideoQualitySubmenu = styled.div<{ isOpen?: boolean }>`
  position: absolute !important;
  left: 0 !important;
  bottom: 100% !important;
  margin-bottom: 4px !important;
  background: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(10px) !important;
  -webkit-backdrop-filter: blur(10px) !important;
  border-radius: 8px !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
  min-width: 90px !important;
  max-width: 110px !important;
  overflow: hidden !important;
  opacity: ${(p) => (p.isOpen ? 1 : 0)} !important;
  visibility: ${(p) => (p.isOpen ? 'visible' : 'hidden')} !important;
  pointer-events: ${(p) => (p.isOpen ? 'auto' : 'none')} !important;
  transition: opacity 0.2s ease, visibility 0.2s ease !important;
  z-index: 1001 !important;
  white-space: nowrap !important;
`

export const SC_VideoQualitySubmenuItemInner = styled.button<{ isActive?: boolean }>`
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  width: 100% !important;
  padding: 4px 10px !important;
  background: transparent !important;
  border: none !important;
  cursor: pointer !important;
  color: ${(p) => (p.isActive ? '#ff0000' : '#333')} !important;
  font-size: 11px !important;
  font-weight: ${(p) => (p.isActive ? '600' : '400')} !important;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
  transition: background-color 0.15s ease, color 0.15s ease !important;
  text-align: left !important;
  box-sizing: border-box !important;
  white-space: nowrap !important;

  &:hover {
    background: rgba(0, 0, 0, 0.08) !important;
  }

  &:active {
    background: rgba(0, 0, 0, 0.12) !important;
  }

  &:focus {
    outline: none !important;
  }

  &:not(:last-child) {
    border-bottom: 1px solid rgba(0, 0, 0, 0.05) !important;
  }
`

export const SC_VideoQualityMenuItem = styled.button<{ isActive?: boolean }>`
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  width: 100% !important;
  padding: 6px 12px !important;
  background: transparent !important;
  border: none !important;
  cursor: pointer !important;
  color: ${(p) => (p.isActive ? '#ff0000' : '#333')} !important;
  font-size: 12px !important;
  font-weight: ${(p) => (p.isActive ? '600' : '400')} !important;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
  transition: background-color 0.15s ease, color 0.15s ease !important;
  text-align: left !important;
  box-sizing: border-box !important;

  &:hover {
    background: rgba(0, 0, 0, 0.08) !important;
  }

  &:active {
    background: rgba(0, 0, 0, 0.12) !important;
  }

  &:focus {
    outline: none !important;
  }

  &:not(:last-child) {
    border-bottom: 1px solid rgba(0, 0, 0, 0.05) !important;
  }
`

export const SC_VideoFullscreenButton = styled.button`
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
  width: 40px !important;
  height: 40px !important;
  min-width: 40px !important;
  min-height: 40px !important;
  box-sizing: border-box !important;
  margin-left: auto !important;

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

export const SC_PlaybackRateNotification = styled.div<{ show?: boolean }>`
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
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
  white-space: nowrap !important;
  user-select: none !important;
  pointer-events: none !important;
  opacity: ${(p) => (p.show ? 1 : 0)} !important;
  visibility: ${(p) => (p.show ? 'visible' : 'hidden')} !important;
  transition: opacity 0.2s ease, visibility 0.2s ease !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
`

export const SC_SeekNotification = styled.div<{ show?: boolean }>`
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
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
  white-space: nowrap !important;
  user-select: none !important;
  pointer-events: none !important;
  opacity: ${(p) => (p.show ? 1 : 0)} !important;
  visibility: ${(p) => (p.show ? 'visible' : 'hidden')} !important;
  transition: opacity 0.2s ease, visibility 0.2s ease !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
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
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
  white-space: nowrap !important;
  user-select: none !important;
  pointer-events: none !important;
  opacity: ${(p) => (p.show ? 1 : 0)} !important;
  visibility: ${(p) => (p.show ? 'visible' : 'hidden')} !important;
  transition: opacity 0.2s ease, visibility 0.2s ease !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
`

export const SC_IconNotification = styled.div<{ show?: boolean }>`
  position: absolute !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  z-index: 100 !important;
  background: rgba(0, 0, 0, 0.5) !important;
  backdrop-filter: blur(4px) !important;
  -webkit-backdrop-filter: blur(4px) !important;
  padding: 20px !important;
  border-radius: 50% !important;
  color: #fff !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  user-select: none !important;
  pointer-events: none !important;
  opacity: ${(p) => (p.show ? 1 : 0)} !important;
  visibility: ${(p) => (p.show ? 'visible' : 'hidden')} !important;
  transition: opacity 0.2s ease, visibility 0.2s ease !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
`

export const SC_HotkeysHelpOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.85);
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
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 24px;
  max-width: 600px;
  width: 90%;
  max-height: 90%;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
`

export const SC_HotkeysHelpTitle = styled.h3`
  margin: 0 0 20px 0;
  font-size: 20px;
  font-weight: 600;
  text-align: center;
  color: #333;
`

export const SC_HotkeysHelpList = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;

  @media (min-width: 500px) {
    grid-template-columns: 1fr 1fr;
    gap: 12px 24px;
  }
`

export const SC_HotkeysHelpItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);

  &:last-child {
    border-bottom: none;
  }
`

export const SC_HotkeysKey = styled.span`
  background: rgba(0, 0, 0, 0.05);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 16px;
  font-weight: bold;
  white-space: nowrap;
  color: #333;
  border: 1px solid rgba(0, 0, 0, 0.1);
`

export const SC_HotkeysDescription = styled.span`
  font-size: 16px;
  color: #555;
  text-align: right;
  margin-left: 10px;
`

export const SC_HotkeysCloseButton = styled.button`
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  padding: 4px;
  transition: color 0.2s;

  &:hover {
    color: #333;
  }
`
