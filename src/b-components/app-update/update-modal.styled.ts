import styled from 'vue3-styled-components'

export const SC_Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const SC_Headline = styled.div`
  color: var(--ui-text-highlighted);
  font-size: 15px;
  font-weight: 600;
`

export const SC_Meta = styled.div`
  color: var(--color-text-secondary);
  font-size: 13px;
`

export const SC_Footer = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
`

export const SC_PrimaryButton = styled.button`
  background: var(--color-primary);
  color: var(--ui-text-inverted);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--transition-fast);

  &:hover {
    background: var(--color-primary-hover);
    border-color: var(--color-primary-hover);
    color: var(--ui-text-inverted);
  }
`

export const SC_GhostButton = styled.button`
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: color var(--transition-fast);

  &:hover {
    background: transparent;
    color: var(--color-text-primary);
  }
`
