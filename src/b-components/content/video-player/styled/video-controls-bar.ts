// @ts-expect-error vue3-styled-components types
import styled from 'vue3-styled-components'

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

  @media (max-width: 768px) {
    gap: 6px !important;
    padding: 8px 10px calc(8px + var(--safe-bottom)) 10px !important;
    min-height: 56px !important;
    height: auto !important;
  }

  @media (max-width: 480px) {
    gap: 4px !important;
    padding: 6px 8px calc(6px + var(--safe-bottom)) 8px !important;
  }
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
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
  white-space: nowrap !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 4px !important;
  box-sizing: border-box !important;
`

export const SC_VideoChapterMarker = styled.div`
  position: absolute !important;
  top: 0 !important;
  bottom: 0 !important;
  width: 2px !important;
  background-color: rgba(255, 255, 255, 0.95) !important;
  pointer-events: none !important;
  z-index: 3 !important;
  transform: translateX(-1px) !important;
`

export const SC_VideoChapterTitle = styled.span`
  color: #333 !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  user-select: none !important;
  flex-shrink: 1 !important;
  min-width: 0 !important;
  max-width: 220px !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
  padding: 0 4px !important;
  opacity: 0.85 !important;
`
