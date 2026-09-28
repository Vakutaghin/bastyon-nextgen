import styled from 'vue3-styled-components'

export const SC_Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const SC_Text = styled.p`
  margin: 0;
  color: var(--color-text-primary);
  font-size: 14px;
  line-height: 1.5;
`

export const SC_Note = styled.p`
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.5;
`

export const SC_ModelList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const SC_ModelOption = styled.label`
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: start;
  gap: 2px 10px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--ui-radius-lg);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background-color var(--transition-fast);

  &:hover {
    border-color: var(--color-primary-hover);
  }

  &.selected {
    border-color: var(--color-primary);
    background-color: var(--color-primary-light);
  }

  input {
    margin: 3px 0 0;
    accent-color: var(--color-primary);
  }
`

export const SC_ModelName = styled.span`
  color: var(--ui-text-highlighted);
  font-size: 14px;
  font-weight: 600;
`

export const SC_ModelSize = styled.span`
  color: var(--color-text-secondary);
  font-size: 13px;
  white-space: nowrap;
`

export const SC_ModelHint = styled.span`
  grid-column: 2 / 4;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.4;
`

export const SC_Badge = styled.span`
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: var(--ui-radius-full);
  background-color: var(--color-primary-light-15);
  color: var(--ui-primary-text);
  font-size: 11px;
  font-weight: 500;
`

export const SC_Progress = styled.progress`
  width: 100%;
  height: 6px;
  overflow: hidden;
  appearance: none;
  border: 0;
  border-radius: var(--ui-radius-full);
  background: var(--ui-bg-accented);
  accent-color: var(--ui-primary);

  &::-webkit-progress-bar {
    background: var(--ui-bg-accented);
    border-radius: var(--ui-radius-full);
  }

  &::-webkit-progress-value {
    background: var(--ui-primary);
    border-radius: var(--ui-radius-full);
    transition: width var(--transition-fast);
  }

  &::-moz-progress-bar {
    background: var(--ui-primary);
    border-radius: var(--ui-radius-full);
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
  background: var(--color-primary);
  color: var(--ui-text-inverted);
  border: 1px solid var(--color-primary);
  border-radius: var(--ui-radius-lg);
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
  border-radius: var(--ui-radius-lg);
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: color var(--transition-fast);

  &:hover {
    background: transparent;
    color: var(--color-text-primary);
  }
`
