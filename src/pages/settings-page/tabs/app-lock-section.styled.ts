import styled from 'vue3-styled-components'

export const SC_AppLockActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

export const SC_AppLockRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  color: var(--ui-text);
`

export const SC_AppLockHint = styled.span`
  font-size: 12px;
  line-height: calc(1.5 * var(--leading-scale));
  color: var(--ui-text-muted);
`

export const SC_SetupBody = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding-top: 4px;

  & > .ant-segmented {
    align-self: stretch;
  }

  & > .ant-segmented + .ant-segmented {
    align-self: center;
  }
`
