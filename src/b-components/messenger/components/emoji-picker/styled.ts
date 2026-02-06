import styled from 'vue3-styled-components'

export const SC_EmojiPickerContainer = styled.div`
  position: absolute;
  bottom: 70px;
  right: 16px;
  width: 300px;
  height: 350px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  border: 1px solid #eee;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

export const SC_EmojiHeader = styled.div`
  padding: 10px;
  border-bottom: 1px solid #eee;
  font-weight: 600;
  background: #f9f9f9;
`

export const SC_EmojiGrid = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
  
  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: #ccc;
    border-radius: 2px;
  }
`

export const SC_EmojiButton = styled.button`
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: #f0f0f0;
  }
`
