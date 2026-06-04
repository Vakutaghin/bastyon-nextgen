// @ts-expect-error vue3-styled-components types
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

/** Размытый фон из превью — заполняет контейнер (cover), под основной превьюшкой */
export const SC_VideoThumbnailBackdrop = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  z-index: 0;
  pointer-events: none;
  filter: blur(20px);
  -webkit-filter: blur(20px);
  transform: scale(1.05);
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
  background-color: transparent;
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
  transition:
    opacity 0.3s ease,
    visibility 0.3s ease;
  pointer-events: ${(p) => (p.show !== undefined && p.show ? 'auto' : 'none')};
  /* Убеждаемся, что контролы не влияют на layout - абсолютное позиционирование выводит из потока */
  height: auto;
  width: 100%;
  box-sizing: border-box;
  /* Важно: не должно быть margin/padding, которые могут влиять на размеры */
  margin: 0;
  padding: 0;
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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;

  p {
    margin: 0;
    font-size: 16px;
    color: white !important;
  }
`

export const SC_VideoRetryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border: 1px solid rgba(255, 255, 255, 0.35) !important;
  border-radius: 6px;
  background-color: rgba(255, 255, 255, 0.1) !important;
  color: white !important;
  font-size: 14px;
  cursor: pointer !important;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.22) !important;
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
