import styled from 'vue3-styled-components'

export const SC_MenuButton = styled.button`
  flex: none;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--ui-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  cursor: pointer;

  &:hover,
  &[aria-expanded='true'] {
    background: var(--ui-bg-muted);
    color: var(--ui-text);
  }
`
