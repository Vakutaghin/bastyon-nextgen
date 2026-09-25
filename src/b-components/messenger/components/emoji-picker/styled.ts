import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_EmojiPickerContainer = styled.div`
  position: absolute;
  bottom: 70px;
  right: 16px;
  width: 300px;
  height: 350px;
  background: var(--color-bg-primary);
  border-radius: var(--ui-radius-lg);
  box-shadow: ${COLORS.SHADOW_LG};
  border: 1px solid var(--ui-border);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

export const SC_EmojiHeader = styled.div`
  padding: 10px;
  border-bottom: 1px solid var(--ui-border);
  font-weight: 600;
  background: var(--color-bg-light);
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
    background: var(--ui-border-accented);
    border-radius: var(--ui-radius-xs);
  }
`

export const SC_EmojiButton = styled.button`
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
  border-radius: var(--ui-radius-sm);
  transition: background var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: var(--color-bg-hover);
  }
`
