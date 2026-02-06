import styled from 'vue3-styled-components'


export const SC_MessengerWrapper = styled.div`
  position: fixed;
  bottom: 14px;
  right: 14px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
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

  svg, img {
    width: 24px;
    height: 24px;
    fill: currentColor;
    display: block;
  }
`

export const SC_FullScreenOverlay = styled.div`
  position: fixed;
  top: 60px;
  left: 0;
  width: 100vw;
  height: calc(100vh - 60px);
  z-index: 2500;
  background-color: #fff;
  display: flex;
  flex-direction: column;
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

  svg, img {
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
  max-width: 1600px;
`
