import styled from 'vue3-styled-components'


export const SC_MessengerContainer = styled.div`
  flex: 1;
  display: flex;
  background: white;
  border-radius: 8px;
  border: 1px solid #eee;
  overflow: hidden;
  /* Remove margin here, let parent control it */
  /* margin: 20px 0; */ 
  height: 100%;
`

const sidebarProps = {
  isHidden: Boolean
}

export const SC_SidebarColumn = styled('div', sidebarProps)`
  width: 320px;
  border-right: 1px solid #eee;
  display: flex;
  flex-direction: column;
  background: #fff;

  @media (max-width: 768px) {
    width: 100%;
    display: ${props => props.isHidden ? 'none' : 'flex'};
  }
`

const chatProps = {
  isActive: Boolean
}

export const SC_ChatColumn = styled('div', chatProps)`
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
  position: relative;

  @media (max-width: 768px) {
    display: ${props => props.isActive ? 'flex' : 'none'};
    width: 100%;
  }
`

export const SC_EmptyState = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 16px;
  flex-direction: column;
  gap: 16px;

  svg {
    width: 64px;
    height: 64px;
    fill: #eee;
  }
`

export const SC_MobileBackButton = styled.button`
  margin-right: 12px;
  background: none;
  border: none;
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 0;

  @media (max-width: 768px) {
    display: flex;
  }
`

export const SC_MessengerDialogsLoader = styled.div`
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #888;
  font-size: 14px;
`

export const SC_MessengerDialogsSpinner = styled.span`
  display: inline-block;
  width: 32px;
  height: 32px;
  border: 3px solid #e0e0e0;
  border-top-color: #666;
  border-radius: 50%;
  animation: messenger-dialogs-spin 0.8s linear infinite;

  @keyframes messenger-dialogs-spin {
    to { transform: rotate(360deg); }
  }
`

export const SC_MessengerDialogsLoaderText = styled.span`
  margin: 0;
`
