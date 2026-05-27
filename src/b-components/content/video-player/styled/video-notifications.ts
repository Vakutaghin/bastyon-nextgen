// @ts-expect-error vue3-styled-components types
import styled from 'vue3-styled-components'

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
  transition:
    opacity 0.2s ease,
    visibility 0.2s ease !important;
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
