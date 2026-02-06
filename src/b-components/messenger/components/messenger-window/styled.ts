import styled from 'vue3-styled-components'

const props = {
  isOpen: Boolean
}

export const SC_Window = styled('div', props)`
  width: 360px;
  height: 500px;
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  margin-bottom: 14px;
  overflow: hidden;
  transform-origin: bottom right;
  transition: opacity 0.2s, transform 0.2s;
  opacity: ${props => props.isOpen ? '1' : '0'};
  transform: ${props => props.isOpen ? 'scale(1)' : 'scale(0.9)'};
  pointer-events: ${props => props.isOpen ? 'auto' : 'none'};
`

export const SC_Header = styled.div`
  height: 56px;
  background-color: #00A3F7;
  color: white;
  display: flex;
  align-items: center;
  padding: 0 16px;
  font-weight: 600;
  font-size: 16px;
  flex-shrink: 0;
  gap: 12px;
`

export const SC_Title = styled.div`
  flex: 1;
`

export const SC_Content = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: white;
`
