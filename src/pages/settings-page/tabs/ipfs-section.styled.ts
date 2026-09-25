import styled from 'vue3-styled-components'

export const SC_IpfsCard = styled.div`
  margin-top: 20px;
  padding: 16px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--ui-radius-lg);
  display: flex;
  flex-direction: column;
  gap: 10px;
`

export const SC_IpfsHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`

export const SC_IpfsTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_IpfsStatus = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
`

export const SC_IpfsDesc = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text-secondary);
`

export const SC_IpfsActions = styled.div`
  display: flex;
`
