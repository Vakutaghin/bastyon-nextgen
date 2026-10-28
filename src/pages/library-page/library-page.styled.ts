import styled from 'vue3-styled-components'

export const SC_HeadActions = styled.div`
  display: flex;
  gap: 8px;
  margin-left: auto;
`

export const SC_RenameForm = styled.form`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 14px;
  font-weight: 400;
  letter-spacing: 0;

  input {
    min-width: 220px;
    height: 32px;
    padding: 0 10px;
    border: 1px solid var(--ui-border-accented);
    border-radius: var(--ui-radius-md);
    background: var(--ui-bg);
    color: var(--ui-text);
    font-size: 14px;
  }
`

export const SC_Back = styled.div`
  margin-bottom: 16px;
  font-size: 13px;

  a {
    color: var(--ui-text-muted);
    text-decoration: none;
  }

  a:hover {
    color: var(--ui-text);
  }
`
