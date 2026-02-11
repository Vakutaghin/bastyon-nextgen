import styled from 'vue3-styled-components'


export const SC_LeftSidebar = styled.div`
  width: 280px;
  min-width: 280px;
  max-height: calc(100vh - 70px);
  background: rgb(255, 255, 255);
  border-right: 1px solid rgba(206, 212, 218, 0.3);
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
  transition: width 0.2s ease, min-width 0.2s ease, padding 0.2s ease;

  &.collapsed {
    width: 64px;
    min-width: 64px;
    padding: 12px 8px;
  }

  @media (max-width: 800px) {
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
