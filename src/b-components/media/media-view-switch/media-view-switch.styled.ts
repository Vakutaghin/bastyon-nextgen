import styled from 'vue3-styled-components'

/** Две кнопки-иконки, выбранная — на подложке (как вид в «Медиастудии»). */
export const SC_ViewSwitch = styled.div`
  display: inline-flex;
  flex: none;
  padding: 2px;
  background: var(--ui-bg-elevated);
  border-radius: var(--ui-radius-md);

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 28px;
    padding: 0;
    color: var(--ui-text-muted);
    font-size: 16px;
    background: none;
    border: 0;
    border-radius: var(--ui-radius-sm);
    cursor: pointer;
  }

  button:hover {
    color: var(--ui-text-highlighted);
  }

  button.active {
    color: var(--ui-text-highlighted);
    background: var(--ui-bg);
    box-shadow: var(--ui-shadow-sm);
  }

  button:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
  }
`
