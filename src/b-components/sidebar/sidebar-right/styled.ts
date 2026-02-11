import styled from 'vue3-styled-components'

export const SC_RightSidebar = styled.div`
  width: 280px;
  min-width: 280px;
  max-height: calc(100vh - 70px);
  background: rgb(255, 255, 255);
  border-left: 1px solid rgba(206, 212, 218, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: sticky;
  align-self: flex-start;
  flex-shrink: 0;
  top: 62px;
  border-radius: 8px;
  padding: 20px;
  overflow-y: auto;
  overflow-x: hidden;
  z-index: 10;

  @media (max-width: 1200px) {
    display: none;
  }

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(206, 212, 218, 0.5);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: rgba(173, 181, 189, 0.7);
  }
`
