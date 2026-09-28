import styled from 'vue3-styled-components'

export const SC_VoiceCard = styled.div`
  margin-top: 20px;
  padding: 16px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--ui-radius-lg);
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const SC_VoiceHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`

export const SC_VoiceTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_VoiceStatus = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
`

export const SC_VoiceDesc = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text-secondary);
`

export const SC_ModelRows = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const SC_ModelRow = styled.div`
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 2px 10px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--ui-radius-lg);

  &.selected {
    border-color: var(--color-primary);
    background-color: var(--color-primary-light);
  }

  input {
    margin: 0;
    accent-color: var(--color-primary);
  }
`

export const SC_ModelInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

export const SC_ModelLine = styled.div`
  color: var(--ui-text-highlighted);
  font-size: 14px;
  font-weight: 600;
`

export const SC_ModelMeta = styled.span`
  margin-left: 6px;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 400;
`

export const SC_ModelHint = styled.div`
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.4;
`

export const SC_ModelActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
`

export const SC_Commands = styled.details`
  font-size: 13px;
  color: var(--color-text-secondary);

  summary {
    cursor: pointer;
    color: var(--color-text-primary);
  }
`

export const SC_CommandList = styled.dl`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 16px;
  margin: 8px 0 0;

  dt {
    color: var(--color-text-primary);
  }

  dd {
    margin: 0;
    font-family: var(--font-family-mono);
  }
`
