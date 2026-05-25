import styled from 'vue3-styled-components'

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
  color: white;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;

  &:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }

  svg,
  img {
    width: 24px;
    height: 24px;
    fill: currentColor;
    display: block;
  }
`

export const SC_FullScreenOverlay = styled.div`
  position: fixed;
  top: var(--header-height-total);
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: calc(100vh - var(--header-height-total));
  z-index: 2500;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  padding-bottom: var(--safe-bottom);
  padding-left: var(--safe-left);
  padding-right: var(--safe-right);
`

export const SC_CloseOverlayButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;

  &:hover {
    color: #333;
    background-color: #f5f5f5;
    border-radius: 50%;
  }

  svg,
  img {
    width: 24px;
    height: 24px;
    fill: currentColor;
  }
`

export const SC_OverlayHeader = styled.div`
  padding: 16px;
  display: flex;
  justify-content: flex-end;
  background: #fff;
  border-bottom: 1px solid #eee;
`

export const SC_OverlayContent = styled.div`
  flex: 1;
  overflow: hidden;
  padding: 20px;
  width: 100%;
  margin: 0 auto;
  max-width: var(--content-max-width);

  @media (max-width: 768px) {
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
  color: #888;
  font-size: 14px;
`

export const SC_MessengerWrapperSpinner = styled.span`
  display: inline-block;
  width: 32px;
  height: 32px;
  border: 3px solid #e0e0e0;
  border-top-color: #666;
  border-radius: 50%;
  animation: messenger-wrapper-spin 0.8s linear infinite;

  @keyframes messenger-wrapper-spin {
    to {
      transform: rotate(360deg);
    }
  }
`

export const SC_MessengerWrapperLoaderText = styled.span`
  margin: 0;
`
