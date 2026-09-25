import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_FabButton = styled.button`
  position: fixed;
  bottom: 24px;
  left: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background-color: var(--ui-primary);
  color: var(--ui-text-inverted);
  border: none;
  cursor: pointer;
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  pointer-events: auto;
  transition: all var(--transition-normal);

  &:hover {
    background-color: rgb(var(--ui-primary-rgb) / 75%);
    box-shadow: ${COLORS.SHADOW_LG};
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
`
