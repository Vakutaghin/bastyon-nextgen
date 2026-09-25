import styled from 'vue3-styled-components'

export const SC_AttachmentRoot = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
`

export const SC_AttachButton = styled.button`
  /* Ghost-кнопка, как смайлик рядом: без рамки, подложка на наведении. */
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  font-size: 18px;
  line-height: 1;
  color: var(--ui-text-dimmed);
  transition:
    color var(--transition-fast),
    background-color var(--transition-fast);

  &:hover {
    color: var(--ui-text-highlighted);
    background: var(--ui-bg-elevated);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

export const SC_Menu = styled.div`
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  background: var(--ui-bg);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  box-shadow: var(--ui-shadow-lg);
  padding: 4px;
  min-width: 160px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 2px;
`

export const SC_MenuItem = styled.button`
  background: none;
  border: 0;
  text-align: left;
  padding: 6px 8px;
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ui-text);

  &:hover:not(:disabled) {
    color: var(--ui-text-highlighted);
    background: rgb(var(--ui-bg-elevated-rgb) / 50%);
  }

  &:disabled {
    opacity: 0.75;
    cursor: not-allowed;
  }
`

export const SC_HiddenInput = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
`
