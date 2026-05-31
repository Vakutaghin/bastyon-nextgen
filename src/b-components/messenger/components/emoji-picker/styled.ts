import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_EmojiPickerContainer = styled.div`
  position: absolute;
  bottom: 70px;
  right: 16px;
  width: 300px;
  height: 350px;
  background: ${COLORS.BG_PRIMARY};
  border-radius: 12px;
  box-shadow: ${COLORS.SHADOW_LG};
  border: 1px solid ${COLORS.GRAY_EEE};
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

export const SC_EmojiHeader = styled.div`
  padding: 10px;
  border-bottom: 1px solid ${COLORS.GRAY_EEE};
  font-weight: 600;
  background: ${COLORS.BG_LIGHT};
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
    background: ${COLORS.GRAY_CCC};
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
    background: ${COLORS.BG_HOVER};
  }
`
