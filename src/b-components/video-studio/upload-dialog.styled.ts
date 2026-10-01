import styled from 'vue3-styled-components'

export const SC_Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const SC_Drop = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 16px;
  border: 2px dashed var(--ui-border);
  border-radius: var(--ui-radius-lg);
  text-align: center;
  transition: border-color var(--transition-fast);

  &.dragging {
    border-color: var(--ui-primary);
  }
`

export const SC_DropIcon = styled.div`
  font-size: 40px;
  color: var(--ui-primary);
  line-height: 1;
`

export const SC_DropTitle = styled.div`
  color: var(--ui-text-highlighted);
  font-size: 16px;
  font-weight: 600;
`

export const SC_Hint = styled.div`
  color: var(--ui-text-muted);
  font-size: 12px;
  line-height: 1.5;
`

export const SC_FileLine = styled.div`
  color: var(--ui-text-muted);
  font-size: 13px;
  overflow-wrap: anywhere;
`

export const SC_Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;

  label {
    color: var(--ui-text-highlighted);
    font-size: 13px;
    font-weight: 500;
  }
`

export const SC_Status = styled.div`
  color: var(--ui-text);
  font-size: 13px;
  line-height: 1.5;

  &.error {
    color: var(--ui-error);
  }
`

export const SC_Footer = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
`

export const SC_PrimaryButton = styled.button`
  background: var(--ui-primary);
  color: var(--ui-text-inverted);
  border: 1px solid var(--ui-primary);
  border-radius: var(--ui-radius-lg);
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition-fast);

  &:hover {
    opacity: 0.9;
  }
`

export const SC_GhostButton = styled.button`
  background: transparent;
  color: var(--ui-text-muted);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: color var(--transition-fast);

  &:hover {
    color: var(--ui-text-highlighted);
  }
`
