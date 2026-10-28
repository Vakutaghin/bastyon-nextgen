import styled from 'vue3-styled-components'

export const SC_NewForm = styled.form`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;

  input {
    flex: 1 1 220px;
    min-width: 0;
    height: 32px;
    padding: 0 10px;
    border: 1px solid var(--ui-border-accented);
    border-radius: var(--ui-radius-md);
    background: var(--ui-bg);
    color: var(--ui-text);
    font-size: 14px;
  }

  input:focus {
    outline: 2px solid rgb(var(--ui-primary-rgb) / 40%);
    border-color: var(--ui-primary);
  }
`
