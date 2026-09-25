import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

const props = {
  isOpen: Boolean,
}

export const SC_Window = styled('div', props)`
  width: 360px;
  height: 500px;
  background-color: var(--color-bg-primary);
  border-radius: var(--ui-radius-lg);
  box-shadow: ${COLORS.SHADOW_LG};
  display: flex;
  flex-direction: column;
  margin-bottom: 14px;
  overflow: hidden;
  transform-origin: bottom right;
  transition:
    opacity var(--transition-fast),
    transform var(--transition-fast);
  opacity: ${(props) => (props.isOpen ? '1' : '0')};
  transform: ${(props) => (props.isOpen ? 'scale(1)' : 'scale(0.9)')};
  pointer-events: ${(props) => (props.isOpen ? 'auto' : 'none')};
`

export const SC_Header = styled.div`
  /* Шапка окна как у Nuxt UI: фон страницы, линия снизу, яркий заголовок. */
  height: 56px;
  background-color: var(--ui-bg);
  color: var(--ui-text-highlighted);
  border-bottom: 1px solid var(--ui-border);
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
  background-color: var(--color-bg-primary);
`

export const SC_CloseButton = styled.button`
  appearance: none;
  border: none;
  padding: 0;
  background: transparent;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-left: 8px;
  border-radius: var(--ui-radius-md);
  color: var(--ui-text-muted);
  font-size: 16px;

  &:hover {
    background: var(--ui-bg-elevated);
    color: var(--ui-text-highlighted);
  }
`
