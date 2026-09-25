import styled from 'vue3-styled-components'

export const SC_MessengerButton = styled('button', { isOpen: Boolean })`
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background-color: var(--ui-primary);
  color: var(--ui-text-inverted);
  border: none;
  box-shadow: var(--shadow-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition:
    transform var(--transition-fast),
    background-color var(--transition-fast);
  z-index: 1001;
  pointer-events: auto;

  &:hover {
    transform: scale(1.05);
    background-color: var(--ui-primary);
    color: var(--ui-text-inverted);
  }

  &:active {
    transform: scale(0.95);
  }

  .ui-icon {
    font-size: 22px;
  }
`

export const SC_UnreadBadge = styled.span`
  position: absolute;
  top: -4px;
  right: -4px;
  background-color: var(--ui-error);
  color: var(--ui-text-inverted);
  font-size: 12px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 999px;
  border: 0;
  box-shadow: 0 0 0 2px var(--ui-bg);
  min-width: 20px;
  text-align: center;
`
