import styled from 'vue3-styled-components'

export const SC_Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: min(70vh, 560px);
  overflow-y: auto;
  margin: 0 -8px;
  padding: 0 8px;
`

export const SC_Preview = styled.p`
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--ui-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_Section = styled.h3`
  margin: 12px 0 4px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--ui-text-dimmed);
`

export const SC_Hint = styled.p`
  margin: 0 0 4px;
  font-size: 12px;
  line-height: calc(1.4 * var(--leading-scale));
  color: var(--ui-text-muted);
`

export const SC_Row = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 6px;
  border: 0;
  border-radius: var(--ui-radius-md);
  background: none;
  color: var(--ui-text);
  text-align: left;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--ui-bg-muted);
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`

export const SC_Check = styled.span`
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: var(--ui-radius-sm);
  border: 1.5px solid var(--ui-border-accented);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: transparent;
  font-size: 13px;

  &.on {
    background: var(--ui-primary);
    border-color: var(--ui-primary);
    color: var(--ui-text-inverted);
  }
`

export const SC_RowText = styled.span`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SC_RowSub = styled.span`
  font-size: 12px;
  color: var(--ui-text-muted);
`

export const SC_RowNote = styled.span`
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--ui-text-dimmed);
`

export const SC_LinkButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 6px;
  border: 0;
  background: none;
  color: var(--ui-primary);
  font-size: 14px;
  cursor: pointer;
  text-align: left;

  &:hover {
    text-decoration: underline;
  }
`

export const SC_NewRow = styled.form`
  display: flex;
  gap: 8px;
  padding: 6px;

  input {
    flex: 1;
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

export const SC_Status = styled.p`
  margin: 4px 6px;
  font-size: 13px;
  color: var(--ui-text-muted);
`
