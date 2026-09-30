import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

/** Над полосой ввода, какой бы высоты ни стало поле; в узком окне — по его ширине. */
export const SC_EmojiPickerContainer = styled.div`
  position: absolute;
  bottom: calc(100% + 8px);
  right: 12px;
  width: min(300px, calc(100% - 24px));
  height: min(320px, 50vh);
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
  padding: 8px 12px;
  border-bottom: 1px solid var(--ui-border);
  font-size: 13px;
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
